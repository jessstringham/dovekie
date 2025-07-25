use std::collections::HashMap;

use murrelet_gen::MurreletGen;
use serde::Serialize;

use lerpable::Lerpable;
use murrelet::prelude::*;
use murrelet_common::{clamp, StrId};
use murrelet_gen::CanSampleFromDist;
use murrelet_gui::CanMakeGUI;
use murrelet_gui::MurreletGUI;
use murrelet_livecode::types::LivecodeError;
use murrelet_perform::asset_loader::AssetLoaders;
use serde::Serializer;
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




#[derive(Debug, Clone, Livecode, Lerpable, Serialize)]
pub struct DrawingConf {
    data: CustomConf,
}

impl DrawingConf {
    // fn _correct(&self) -> Self {
    //     self.clone()
    // }

    // fn conf_from_seed(seed: u64) -> Self {
    //     Self::gen_from_seed(seed)._correct()
    // }

    // fn conf_from_rns(rns: Vec<f32>) -> Self {
    //     // go through and clamp
    //     let rn_clamped = rns.iter().map(|x| x.clamp(0.0, 1.0)).collect::<Vec<_>>();

    //     Self::sample_dist(&rn_clamped, 0)._correct()
    // }
}

// set up livecoder
#[derive(Debug, Clone, Livecode, Lerpable, TopLevelLiveCodeJson)]
pub struct LiveCodeConf {
    app: AppConfig,
    drawing: DrawingConf,
}

// #[wasm_bindgen]
// pub async fn gui_schema() -> String {
// let data = DrawingConf::make_gui();
//     serde_json::to_string(&data).unwrap_or_else(|_| "Serialization failed".to_string())
// }

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

#[wasm_bindgen]
pub async fn new_model(conf: String) -> WasmMurreletModelResult {
    MurreletModel::new(conf).await
}

#[wasm_bindgen]
pub struct MurreletModel {
    livecode: LiveCode,
}
#[wasm_bindgen]
impl MurreletModel {
    #[wasm_bindgen(constructor)]
    pub async fn new(conf: String) -> WasmMurreletModelResult {
        // turn this on if you need to debug
        std::panic::set_hook(Box::new(console_error_panic_hook::hook));

        let livecode_src = LivecodeSrc::new(vec![Box::new(AppInputValues::new(false))]);

        match LiveCode::new_web(conf, livecode_src, &AssetLoaders::empty()) {
            Ok(livecode) => {
                let r = MurreletModel { livecode };
                WasmMurreletModelResult::ok(r)
            }
            Err(e) => WasmMurreletModelResult::err(e),
        }
    }

    #[wasm_bindgen]
    pub fn update_config(&mut self, conf: String) -> String {
        match self.livecode.update_config_to(&conf) {
            Ok(_) => "Success!".to_owned(),
            Err(e) => e,
        }
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
    ) {
        let app_input =
            MurreletAppInput::new_no_key(vec2(dim_x, dim_y), vec2(mouse_x, mouse_y), click, frame);
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

// just creating a Result<Model, String> that we can send to javascript
#[wasm_bindgen]
pub struct WasmMurreletModelResult {
    m: Option<MurreletModel>,
    err: String,
}

#[wasm_bindgen]
impl WasmMurreletModelResult {
    fn ok(m: MurreletModel) -> WasmMurreletModelResult {
        WasmMurreletModelResult {
            m: Some(m),
            err: String::new(),
        }
    }

    fn err(err: LivecodeError) -> WasmMurreletModelResult {
        WasmMurreletModelResult {
            m: None,
            err: err.to_string(),
        }
    }

    #[wasm_bindgen]
    pub fn is_err(&self) -> bool {
        self.m.is_none()
    }

    #[wasm_bindgen]
    pub fn err_msg(self) -> String {
        self.err
    }

    #[wasm_bindgen]
    pub fn to_model(self) -> MurreletModel {
        // panics if you don't check is error first
        self.m.unwrap()
    }
}
