use std::collections::{BTreeMap, HashMap};

use itertools::Itertools;
use murrelet_common::StrId;
use murrelet_gui::{CanChangeToGUI, MurreletGUISchema};
use murrelet_schema::MurreletSchema;
use murrelet_wasm::*;
use serde::Serialize;

use anyhow::Result;
use lerpable::Lerpable;
use murrelet::prelude::*;
use murrelet_livecode::types::{LivecodeError, LivecodeResult, ToLivecodeResult};
use serde_json;
use wasm_bindgen::prelude::*;

// from the wasm-rust tutorial, this let's you log messages to the js console
// extern crate web_sys;

// A macro to provide `println!(..)`-style syntax for `console.log` logging.
// macro_rules! log {
//     ( $( $t:tt )* ) => {
//         web_sys::console::log_1(&format!( $( $t )* ).into())
//     }
// }

#[derive(Debug, Clone, Livecode, Lerpable, Serialize)]
pub struct CustomConfF32(f32);

#[derive(Debug, Clone, Livecode, Lerpable, Serialize)]
pub struct CustomConfBool(bool);

#[derive(Debug, Clone, Livecode, Lerpable, Serialize)]
pub struct CustomKeyValue {
    key: String,
    value: CustomConf,
}

#[derive(Debug, Clone, Livecode, Lerpable, Serialize)]
pub struct CustomConfVec(Vec<CustomConf>);

#[derive(Debug, Clone, Livecode, Lerpable, Serialize)]
pub struct CustomConfStruct(Vec<CustomKeyValue>);

#[derive(Debug, Clone, Livecode, Lerpable, Serialize)]
pub struct CustomConfEnum {
    choice: String,
    options: Vec<CustomKeyValue>,
}

#[derive(Debug, Clone, Livecode, Lerpable, Serialize)]
#[livecode(enum_tag = "untagged")]
#[serde(untagged)]
pub enum CustomConf {
    F32(CustomConfF32),
    // Bool(CustomConfBool),
    Vec(CustomConfVec),
    Struct(CustomConfStruct),
    // Enum(CustomConfEnum), // choice
}
impl CustomConf {
    fn to_schema(&self) -> MurreletSchema {
        match &self {
            CustomConf::F32(_) => MurreletSchema::Val(murrelet_schema::MurreletPrimitive::Num),
            CustomConf::Vec(v) => {
                let a = v.0.first().unwrap();
                MurreletSchema::List(Box::new(a.to_schema()))
            }
            CustomConf::Struct(v) => MurreletSchema::Struct(
                "struct".to_string(),
                v.0.iter()
                    .map(|kv| (kv.key.clone(), kv.value.to_schema()))
                    .collect::<BTreeMap<_, _>>(),
            ),
        }
    }

    fn to_schema_with_hints(&self, s: &HashMap<String, String>) -> Result<MurreletSchema> {
        self.to_schema().update_with_hints(s)
    }

    // chatgpt
    fn flatten_into(&self, out: &mut Vec<f32>) {
        match self {
            CustomConf::F32(x) => out.push(x.0),
            CustomConf::Vec(v) => {
                for item in &v.0 {
                    item.flatten_into(out);
                }
            }
            CustomConf::Struct(s) => {
                // enforce determinism
                let mut items = s.0.clone();
                items.sort_by(|a, b| a.key.cmp(&b.key));
                for kv in &items {
                    kv.value.flatten_into(out);
                }
            }
        }
    }

    fn flatten_paths_into(&self, prefix: &str, out: &mut Vec<String>) {
        match self {
            CustomConf::F32(_) => out.push(prefix.to_string()),
            CustomConf::Vec(v) => {
                for (i, item) in v.0.iter().enumerate() {
                    let p = format!("{prefix}.{i}");
                    item.flatten_paths_into(&p, out);
                }
            }
            CustomConf::Struct(s) => {
                // Must match flatten_into ordering
                let mut items: Vec<_> = s.0.iter().collect();
                items.sort_by(|a, b| a.key.cmp(&b.key));

                for kv in items {
                    let p = format!("{prefix}.{}", kv.key);
                    kv.value.flatten_paths_into(&p, out);
                }
            }
        }
    }

    fn flatten_paths(&self, root: &str) -> Vec<String> {
        let mut out = Vec::new();
        self.flatten_paths_into(root, &mut out);
        out
    }

    fn flat_len(&self) -> usize {
        match self {
            CustomConf::F32(_) => 1,
            CustomConf::Vec(v) => v.0.iter().map(|x| x.flat_len()).sum(),
            CustomConf::Struct(s) => {
                let mut items: Vec<_> = s.0.iter().collect();
                items.sort_by(|a, b| a.key.cmp(&b.key));
                items.into_iter().map(|kv| kv.value.flat_len()).sum()
            }
        }
    }
}

#[derive(Debug, Clone, Livecode, Lerpable, Serialize)]
pub struct DovekieConf {
    data: CustomConf,
}
impl DovekieConf {
    fn to_schema_with_hints(&self, s: &HashMap<String, String>) -> Result<MurreletSchema> {
        self.data.to_schema_with_hints(s)
    }

    fn raft_leaf_paths(&self) -> Vec<String> {
        self.data.flatten_paths(".row")
    }

    fn raft_stride(&self) -> usize {
        self.data.flat_len()
    }
}

// #[wasm_bindgen]
// pub async fn rn_count() -> usize {
//     DovekieConf::rn_count()
// }

// #[wasm_bindgen]
// pub async fn gen_from_seed(seed: u64) -> String {
//     let data: DovekieConf = DovekieConf::conf_from_seed(seed);
//     serde_json::to_string(&data).unwrap_or_else(|_| "Serialization failed".to_string())
// }

// #[wasm_bindgen]
// pub async fn gen_from_rn(rns: Vec<f32>) -> String {
//     // make sure it's within bounds
//     let rn = rns.into_iter().map(|x| clamp(x, 0.0, 1.0)).collect_vec();

//     let data: DovekieConf = DovekieConf::conf_from_rns(rn);

//     serde_json::to_string(&data).unwrap_or_else(|_| "Serialization failed".to_string())
// }

// #[wasm_bindgen]
// pub async fn new_model(conf: String) -> WasmMurreletModelResult {
//     MurreletModel::new(conf).await
// }

pub struct SchemaInfo {
    schema: MurreletSchema,
    gui_hints: HashMap<String, String>,
}

impl SchemaInfo {
    fn check_conf(&self, c: &DovekieConf) -> LivecodeResult<()> {
        let new_schema = c.to_schema_with_hints(&self.gui_hints).to_lc_err()?;

        if self.schema != new_schema {
            Err(LivecodeError::Raw("schemas don't match!".to_string()))
        } else {
            Ok(())
        }
    }
}

#[derive(serde::Serialize)]
pub struct DovekieRaftOut {
    pub row_count: usize,
    pub leaf_paths: Vec<String>,
    pub out: Vec<f32>,
    pub stride: usize,
}
impl DovekieRaftOut {
    fn empty() -> Self {
        Self {
            out: vec![],
            leaf_paths: vec![],
            stride: 0,
            row_count: 0,
        }
    }

    fn clear(&mut self) {
        self.out.clear();
        self.leaf_paths.clear();
        self.stride = 0;
        self.row_count = 0;
    }

    fn add_drawing_to_raft_out(&mut self, drawing: &DovekieConf) {
        if self.row_count == 0 {
            // if it's the first row
            self.leaf_paths = drawing.raft_leaf_paths();
            self.stride = drawing.raft_stride();
        }
        drawing.data.flatten_into(&mut self.out);
        self.row_count += 1;
    }
}

pub struct DovekieRaft {
    fields: Vec<StrId>,
    data: Vec<f32>,
}
impl DovekieRaft {
    fn new() -> Self {
        Self {
            fields: vec![],
            data: vec![],
        }
    }

    fn set_fields(&mut self, fields: Vec<String>) {
        self.fields = fields.iter().map(|x| StrId::new(&x)).collect_vec();
        self.data.clear();
    }

    fn set_data(&mut self, data: &[f32]) -> LivecodeResult<()> {
        if self.fields.is_empty() {
            return Err("schema not set").to_lc_err();
        }

        let field_len = self.fields.len();
        if data.len() % field_len != 0 {
            return Err(format!("data not divisble by field length {}", field_len)).to_lc_err();
        }

        self.data.clear();
        self.data.extend_from_slice(&data);

        Ok(())
    }

    fn rows(&self) -> impl Iterator<Item = &[f32]> {
        let cols = self.fields.len();
        let rows = self.data.chunks_exact(cols);

        debug_assert!(rows.remainder().is_empty());

        rows
    }
}

pub struct Dovekie {
    conf: DovekieConf,
    raft: DovekieRaft, // a list of custom variables
    schema: Option<SchemaInfo>,
    raft_out: DovekieRaftOut,
}

impl IsMurreletWebModel<DovekieConf> for Dovekie {
    fn init(conf: DovekieConf) -> Self {
        Dovekie {
            conf,
            schema: None,
            raft: DovekieRaft::new(),
            raft_out: DovekieRaftOut::empty(),
        }
    }

    fn get_conf(&self) -> &DovekieConf {
        todo!()
    }

    fn set_conf(&mut self, conf: DovekieConf) {
        self.conf = conf;
    }

    fn reload(&mut self) {
        // todo!()
    }

    fn update(&mut self, _app_input: &MurreletAppInput) {
        // todo!()
    }
}

impl Dovekie {
    fn update_schema(
        &mut self,
        hints: &HashMap<String, String>,
    ) -> LivecodeResult<MurreletGUISchema> {
        let schema = self.conf.to_schema_with_hints(hints).to_lc_err()?;

        let gui = schema.change_to_gui();
        self.schema = Some(SchemaInfo {
            schema,
            gui_hints: hints.clone(),
        });
        Ok(gui)
    }

    fn gui_schema_internal(&mut self, hints: &String) -> LivecodeResult<MurreletGUISchema> {
        let hints_map: std::collections::HashMap<String, String> = serde_json::from_str(&hints)
            .map_err(|x| {
                LivecodeError::Raw(format!(
                    "Error parsing hints as map from string to string {}, {}",
                    hints,
                    x.to_string()
                ))
            })?;

        self.update_schema(&hints_map)
    }

    fn check_schema_internal(&self) -> LivecodeResult<()> {
        if let Some(schema) = &self.schema {
            schema.check_conf(&self.conf)
        } else {
            Ok(())
        }
    }
}

export_murrelet_web_model!(Dovekie<DovekieConf>);

impl DovekieTopLevelWasm {
    pub fn check_schema_inner(&mut self, conf: &str) -> JsResult<()> {
        // hmm, is this really the best way to rollback?
        self.set_config_json(conf)?;
        self.model.check_schema_internal().to_js()
    }
}

#[wasm_bindgen]
impl DovekieTopLevelWasm {
    #[wasm_bindgen]
    pub async fn gui_schema(&mut self, hints: String) -> JsResult<String> {
        match self.model.gui_schema_internal(&hints) {
            Ok(schema) => serde_json::to_string(&schema)
                .map_err(|s| format!("Error serialization failed {s}")),
            Err(err) => Err(err.to_string()),
        }
        .to_js()
    }

    pub fn check_schema(&mut self, conf: &str) -> JsResult<()> {
        let old_conf = self.model.conf.clone();

        let schema_result = self.check_schema_inner(conf);

        if schema_result.is_err() {
            self.model.conf = old_conf;
        }

        schema_result
    }

    // call this once
    pub fn set_raft_names(&mut self, names: Vec<String>) {
        self.model.raft.set_fields(names);
    }

    pub fn set_data(&mut self, names: Vec<String>, data: &[f32]) {
        self.set_raft_names(names);
        self.model.raft.set_data(data).ok();
    }

    pub fn raft_out_ptr(&self) -> *const f32 {
        self.model.raft_out.out.as_ptr()
    }

    pub fn raft_stride(&self) -> usize {
        self.model.raft_out.stride
    }

    pub fn raft_leaf_paths_json(&self) -> String {
        serde_json::to_string(&self.model.raft_out.leaf_paths).unwrap_or("[]".to_string())
    }

    // returns the length
    pub fn o_many(&mut self) -> usize {
        // clear old raft before we get started
        self.model.raft_out.clear();

        let mut app_input = self.app_mng.state().clone();
        let names = &self.model.raft.fields;
        app_input.custom_vars.dangerous_set_names(names);

        for row in self.model.raft.rows() {
            app_input.custom_vars.dangerous_change_data_in_place(row);

            self.livecode.update(&app_input, false).ok();

            self.model
                .raft_out
                .add_drawing_to_raft_out(&self.livecode.config().drawing);
        }

        self.model.raft_out.row_count * self.model.raft_out.stride
    }
}

// #[wasm_bindgen]
// impl MurreletModel {
//     #[wasm_bindgen(constructor)]
//     pub async fn new(conf: String) -> JsResult<MurreletModel> {
//         // turn this on if you need to debug
//         std::panic::set_hook(Box::new(console_error_panic_hook::hook));

//         Self::new_internal(conf).to_js()
//     }

//     #[wasm_bindgen]
//     pub fn update_config(&mut self, conf: String) -> JsResult<()> {
//         // test, adding the schema check here! maybe we add it deeper...
//         // before actually updating it, run some checks that it evaluates to the right schema

//         self.check_schema(&conf)?;

//         self.livecode.update_config_to(&conf).to_js()
//     }

//     #[wasm_bindgen]
//     pub fn update_frame(
//         &mut self,
//         frame: u64,
//         dim_x: f32,
//         dim_y: f32,
//         mouse_x: f32,
//         mouse_y: f32,
//         click: bool,
//         custom_variables: String,
//     ) {
//         let custom_vars: HashMap<String, f32> = match serde_json::from_str(&custom_variables) {
//             Ok(map) => map,
//             Err(err) => {
//                 web_sys::console::error_1(
//                     &format!(
//                         "Failed to parse custom_variables (it should be string -> number): {}",
//                         err
//                     )
//                     .into(),
//                 );
//                 HashMap::new()
//             }
//         };

//         let app_input = MurreletAppInput::new_no_key(
//             vec2(dim_x, dim_y),
//             vec2(mouse_x, mouse_y),
//             click,
//             frame,
//             custom_vars,
//         );
//         // todo, show an error from this?

//         self.livecode.update(&app_input, false).ok();
//     }

//     #[wasm_bindgen]
//     pub fn conf(&self) -> String {
//         let conf = &self.livecode.config().drawing;

//         match serde_json::to_string(&conf) {
//             Ok(s) => s,
//             Err(e) => {
//                 // log the serde error!
//                 web_sys::console::error_1(&format!("serde_json error: {}", e).into());
//                 "Serialization failed".to_string()
//             }
//         }
//     }
// }
