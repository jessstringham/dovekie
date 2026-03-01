use std::collections::{BTreeMap, HashMap};

use murrelet_gui::{CanChangeToGUI, MurreletGUISchema};
use murrelet_schema::MurreletSchema;
use murrelet_wasm::{JsResult, ToJsResult};
use serde::Serialize;

use anyhow::Result;
use lerpable::Lerpable;
use murrelet::prelude::*;
use murrelet_livecode::{
    livecode::LivecodeFromWorld,
    types::{LivecodeError, LivecodeResult, ToLivecodeResult},
};
use murrelet_perform::asset_loader::AssetLoaders;
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
}

#[derive(Debug, Clone, Livecode, Lerpable, Serialize)]
pub struct DrawingConf {
    data: CustomConf,
}
impl DrawingConf {
    fn to_schema_with_hints(&self, s: &HashMap<String, String>) -> Result<MurreletSchema> {
        self.data.to_schema_with_hints(s)
    }
}

// set up livecoder
#[derive(Debug, Clone, Livecode, Lerpable, TopLevelLiveCodeJson)]
pub struct LiveCodeConf {
    app: AppConfig,
    drawing: DrawingConf,
}

// #[wasm_bindgen]
// pub async fn rn_count() -> usize {
//     DrawingConf::rn_count()
// }

// #[wasm_bindgen]
// pub async fn gen_from_seed(seed: u64) -> String {
//     let data: DrawingConf = DrawingConf::conf_from_seed(seed);
//     serde_json::to_string(&data).unwrap_or_else(|_| "Serialization failed".to_string())
// }

// #[wasm_bindgen]
// pub async fn gen_from_rn(rns: Vec<f32>) -> String {
//     // make sure it's within bounds
//     let rn = rns.into_iter().map(|x| clamp(x, 0.0, 1.0)).collect_vec();

//     let data: DrawingConf = DrawingConf::conf_from_rns(rn);

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
    fn check_conf(&self, c: &DrawingConf) -> LivecodeResult<()> {
        let new_schema = c.to_schema_with_hints(&self.gui_hints).to_lc_err()?;

        if self.schema != new_schema {
            Err(LivecodeError::Raw("schemas don't match!".to_string()))
        } else {
            Ok(())
        }
    }
}

#[wasm_bindgen]
pub async fn new_model(conf: String) -> JsResult<MurreletModel> {
    MurreletModel::new(conf).await
}

#[wasm_bindgen]
pub struct MurreletModel {
    livecode: LiveCode,
    schema: Option<SchemaInfo>,
}
impl MurreletModel {
    fn new_internal(conf: String) -> LivecodeResult<MurreletModel> {
        let livecode_src = LivecodeSrc::new(vec![Box::new(AppInputValues::new(false))]);

        match LiveCode::new_web(conf, livecode_src, &AssetLoaders::empty()) {
            Ok(livecode) => {
                let r = MurreletModel {
                    livecode,
                    schema: None,
                };
                Ok(r)
            }
            Err(e) => Err(e),
        }
    }

    fn update_schema(
        &mut self,
        hints: &HashMap<String, String>,
    ) -> LivecodeResult<MurreletGUISchema> {
        match self.livecode.config().drawing.to_schema_with_hints(hints) {
            Ok(schema) => {
                let gui = schema.change_to_gui();
                self.schema = Some(SchemaInfo {
                    schema,
                    gui_hints: hints.clone(),
                });
                Ok(gui)
            }
            Err(err) => Err(LivecodeError::Raw(err.to_string())),
        }
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

    fn check_schema_internal(&self, conf: &str) -> LivecodeResult<()> {
        if let Some(schema) = &self.schema {
            let ctrl = ControlLiveCodeConf::parse(&conf)?;

            let parsed = ctrl.o(self.livecode.world())?;

            schema.check_conf(&parsed.drawing)
        } else {
            Ok(())
        }
    }
}

#[wasm_bindgen]
impl MurreletModel {
    #[wasm_bindgen(constructor)]
    pub async fn new(conf: String) -> JsResult<MurreletModel> {
        // turn this on if you need to debug
        std::panic::set_hook(Box::new(console_error_panic_hook::hook));

        Self::new_internal(conf).to_js()
    }

    #[wasm_bindgen]
    pub async fn gui_schema(&mut self, hints: String) -> JsResult<String> {
        match self.gui_schema_internal(&hints) {
            Ok(schema) => serde_json::to_string(&schema)
                .map_err(|s| format!("Error serialization failed {s}")),
            Err(err) => Err(err.to_string()),
        }
        .to_js()
    }

    pub fn check_schema(&self, conf: &str) -> JsResult<()> {
        self.check_schema_internal(conf).to_js()
    }

    #[wasm_bindgen]
    pub fn update_config(&mut self, conf: String) -> JsResult<()> {
        // test, adding the schema check here! maybe we add it deeper...
        // before actually updating it, run some checks that it evaluates to the right schema

        self.check_schema(&conf)?;

        self.livecode.update_config_to(&conf).to_js()
    }

    #[wasm_bindgen]
    pub fn update_frame(
        &mut self,
        frame: u64,
        dim_x: f32,
        dim_y: f32,
        mouse_x: f32,
        mouse_y: f32,
        click: bool,
        custom_variables: String,
    ) {
        let custom_vars: HashMap<String, f32> = match serde_json::from_str(&custom_variables) {
            Ok(map) => map,
            Err(err) => {
                web_sys::console::error_1(
                    &format!(
                        "Failed to parse custom_variables (it should be string -> number): {}",
                        err
                    )
                    .into(),
                );
                HashMap::new()
            }
        };

        let app_input = MurreletAppInput::new_no_key(
            vec2(dim_x, dim_y),
            vec2(mouse_x, mouse_y),
            click,
            frame,
            custom_vars,
        );
        // todo, show an error from this?

        self.livecode.update(&app_input, false).ok();
    }

    #[wasm_bindgen]
    pub fn conf(&self) -> String {
        let conf = &self.livecode.config().drawing;

        match serde_json::to_string(&conf) {
            Ok(s) => s,
            Err(e) => {
                // log the serde error!
                web_sys::console::error_1(&format!("serde_json error: {}", e).into());
                "Serialization failed".to_string()
            }
        }
    }
}
