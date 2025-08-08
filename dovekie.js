import init, { new_model } from "./rust/pkg/dovekie.js";
import wasmUrl from "./rust/pkg/dovekie_bg.wasm?url";
import "./style.css";
import { MurreletGUI } from "./editor.js";

const defaultApp = {
  time: {},
  ctx: "",
};

export async function wasmInit() {
  await init(wasmUrl);
}

export class MurreletModel {
  constructor(svg) {
    this.murrelet = null;
    this.svg = svg;

    this.app_config = { ...defaultApp };

    // init some things about the mouse
    this.built_in_variables = {
      mouse_x: 0.0, // mouse x
      mouse_y: 0.0, // mouse y
      mouse_down: false,

      // init some things about the window (will update soon)
      dim_x: 600.0, // will be w
      dim_y: 600.0, // will be h

      // init frame count
      frame: 1n,
    };
    // this.mouse_x = 0.0; // mouse x
    // this.mouse_y = 0.0; // mouse y
    // this.mouse_down = false;

    // // init some things about the window (will update soon)
    // this.dim_x = 600.0; // will be w
    // this.dim_y = 600.0; // will be h

    // // init frame count
    // this.frame = 1n;

    // initial, but once we successfully load the model we'll update this

    this.fps = 30; // initial, but we'll load this from the config
    this.lastUpdate = performance.now();

    this.init_conf = null;

    this.gui = null;

    if (svg) {
      console.log("adding event listeners to ", this.svg);
      this.addEventListeners();
    } else {
      // console.log("undefined div, not adding event listeners");
    }
  }

  set_div(div) {
    this.svg = div;

    if (this.svg) {
      console.log("adding event listeners to ", this.svg);
      this.addEventListeners();
    } else {
      console.log("undefined div, not adding event listeners");
    }
  }

  set_bpm(bpm) {
    if (!isNaN(Number(bpm))) {
      this.app_config.time.bpm = Number(bpm);
    }
  }

  set_beats_per_bar(beats_per_bar) {
    if (!isNaN(Number(beats_per_bar))) {
      this.app_config.time.beats_per_bar = Number(beats_per_bar);
    }
  }

  // optionally set up a gui to update the drawing config
  async setup_gui(gui_div, schema_hints) {
    if (this.murrelet === null) {
      console.error("setting up dovekie gui before initializing it!");
    } else {
      let editor_container = document.createElement("div");
      editor_container.id = "editor-wrapper";
      gui_div.appendChild(editor_container);

      let errmsg = document.createElement("div");
      errmsg.id = "errmsg";
      editor_container.appendChild(errmsg);

      this.errmsg = errmsg;

      let editor = document.createElement("div");
      editor.id = "editor";
      editor_container.appendChild(editor);

      const submit_button = document.createElement("button");
      submit_button.id = "submit";
      submit_button.textContent = "submit";
      editor_container.appendChild(submit_button);

      this.gui = new MurreletGUI(this, editor, errmsg);
      await this.gui.init(schema_hints);
      this.gui.build_html(this.init_conf);

      submit_button.onclick = async () => {
        // console.log("updating");
        await this.gui.update();
      };

      editor.addEventListener("keydown", async (event) => {
        if (event.metaKey && event.key === "Enter") {
          // console.log("updating");
          await this.gui.update();
        }
      });

      return this.gui;
    }
  }

  addEventListeners() {
    this.svg.addEventListener("mousemove", (event) => this.mouseMove(event));
    this.svg.addEventListener("mousedown", (event) => this.mouseDown(event));
    this.svg.addEventListener("mouseup", (event) => this.mouseUp(event));

    window.addEventListener("resize", () => this.updateWindowSize());
    document.addEventListener("DOMContentLoaded", () =>
      this.updateWindowSize()
    );
  }

  async init() {
    await init();
    return new MurreletModel();
  }

  async setConfig(drawingConf) {
    // we don't support hashmaps yet, so just convert to vec
    function convertToVec(obj) {
      return Object.entries(obj).map(([key, value]) => {
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          return { key: key, value: convertToVec(value) };
        } else {
          return { key: key, value: value };
        }
      });
    }

    const convertedConf = convertToVec(drawingConf);
    // console.log(convertedConf);

    const conf = { app: defaultApp, drawing: { data: convertedConf } };
    let err_msg = await this.reload(conf);

    if (err_msg != "" && err_msg != "Success!") {
      console.log(JSON.stringify(drawingConf));
      console.log("error from drawing conf:", err_msg);

      return { is_success: false, err_msg };
    } else {
      console.log("success!");
      this.update();
      this.init_conf = drawingConf;

      return { is_success: true };
    }
  }

  async initModel(conf) {
    // if we haven't successfully loaded it, try to do that
    console.log("init model");
    // try {
    let model_or_err = await new_model(conf);
    if (model_or_err.is_err()) {
      console.log(conf);
      console.log("ERROR", model_or_err.err_msg());
      document.getElementById("err_msg").innerHTML = model_or_err.err_msg();
    } else {
      this.murrelet = model_or_err.to_model();
      console.log("model init");
    }
    // } catch (err) {
    //   console.error("init failed", err);
    // }
  }

  paths() {
    return this.svg.getElementsByClassName("paths")[0];
  }

  apply_cmd(cmd) {
    if (this.murrelet !== null) {
      return this.murrelet.apply_cmd(cmd);
    }
  }

  async to_dist() {
    if (this.murrelet !== null) {
      return await this.murrelet.to_dist();
    }
  }

  async to_dist_mask() {
    if (this.murrelet !== null) {
      return await this.murrelet.to_dist_mask();
    }
  }

  async reload(conf) {
    var confMsg = "";

    const confstr = JSON.stringify(conf);

    var isInitial = false;
    if (this.murrelet === null) {
      await this.initModel(confstr);
      isInitial = true;
    }

    if (this.murrelet !== null) {
      confMsg = this.murrelet.update_config(confstr);

      // this.fps = this.murrelet.fps();
      this.updateWindowSize();
    }

    return confMsg;
  }

  updateMurreletWithWorld(custom_variables) {
    if (this.murrelet !== null) {
      let custom_vars = "{}";
      if (custom_variables) {
        custom_vars = JSON.stringify(custom_variables);
      }

      this.murrelet.update_frame(
        this.built_in_variables.frame,
        this.built_in_variables.dim_x,
        this.built_in_variables.dim_y,
        this.built_in_variables.mouse_x,
        this.built_in_variables.mouse_y,
        this.built_in_variables.mouse_down,
        custom_vars
      );
    }
  }

  // get world state
  updateWindowSize() {
    if (this.svg) {
      const rect = this.svg.getBoundingClientRect();
      this.dim_x = rect.width;
      this.dim_y = rect.height;
    }
  }

  mouseMove(event) {
    if (this.svg) {
      const rect = this.svg.getBoundingClientRect();

      // Calculate the x and y coordinates relative to the container
      this.mouse_x = event.clientX - rect.left;
      this.mouse_y = event.clientY - rect.top;
    }
  }

  mouseDown() {
    this.mouse_down = true;
  }

  mouseUp() {
    this.mouse_down = false;
  }

  state() {
    if (this.murrelet !== null) {
      return this.murrelet.state();
    }
  }

  update(custom_variables) {
    if (this.murrelet !== null) {
      const t = performance.now();

      // You _could_ set up FPS, but I'm building this with the assumption folks
      // won't set realtime=false, so we'll just run as fast as we can
      // something like `t - this.lastUpdate > 1000 / this.fps`
      this.updateMurreletWithWorld(custom_variables);

      this.lastUpdate = t;

      this.built_in_variables.frame += 1n;
    }
  }

  params() {
    const raw = JSON.parse(this.murrelet.conf()).data;

    // recursively go through and parse back into the structure
    // it'll either be a struct (list with {key, value}), a vec (a list), or a float.
    function parseParams(data) {
      if (Array.isArray(data)) {
        if (data.length === 0) {
          return [];
        }
        // if it's looking like a struct
        if (typeof data[0] === "object") {
          // assert this is true?
          // data[0] !== null && "key" in data[0] && "value" in data[0]
          let r = {};
          for (let i = 0; i < data.length; i++) {
            const d = data[i];
            r[d.key] = parseParams(d.value);
          }
          return r;
        } else {
          // otherwise it's a regular list
          return data.map(parseParams);
        }
      } else {
        return data;
      }
    }

    return parseParams(raw);
  }
}
