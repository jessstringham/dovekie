import init, { new_model } from "./rust/pkg/dovekie.js";
import wasmUrl from "./rust/pkg/dovekie_bg.wasm?url";
import "./style.css";
import { MurreletGUI, try_to_get_conf_from_url } from "./editor.js";



let wasm = null;

export async function initWasm() {
  if (!wasm) {
    wasm = await init(wasmUrl);
    if (typeof window !== "undefined") window.dovekie_wasm = wasm;
  }
  return wasm;
}

export function getWasm() {
  if (!wasm) throw new Error("Call initWasm() first");
  return wasm;
}


// chatgpt to test this out...
class RaftResult {
  constructor(flat, stride, paths) {
    this.flat = flat;                // copied Float32Array
    this.stride = stride;            // columns per row
    this.paths = paths;              // e.g. ["zoom.x", "zoom.y", ...]
    this.rowCount = stride === 0 ? 0 : (flat.length / stride) | 0;

    this.pathToCol = new Map();
    for (let i = 0; i < paths.length; i++) this.pathToCol.set(paths[i], i);
  }

  get(row, path) {
    if (row < 0 || row >= this.rowCount) throw new RangeError(`row ${row} out of range`);
    const col = this.pathToCol.get(path);
    if (col == null) throw new Error(`Unknown path: ${path}`);
    return this.flat[row * this.stride + col];
  }

  // Optional: materialize one row only when needed
  rowObject(row) {
    if (row < 0 || row >= this.rowCount) throw new RangeError(`row ${row} out of range`);
    const base = row * this.stride;
    const out = {};
    for (let i = 0; i < this.paths.length; i++) out[this.paths[i]] = this.flat[base + i];
    return out;
  }
}


export class Dovekie {
  constructor(
    opts = { svg: null, default_custom_variables: {} }
  ) {
    // if you want to use mouse events, use this to set what the mouse is relative to!
    const { svg, default_custom_variables } = opts;

    this.murrelet = null;
    this.svg = svg;

    this.default_custom_variables = default_custom_variables;

    this.fps = 30; // initial, but we'll load this from the config
    this.lastUpdate = performance.now();

    this.init_conf = null;

    this.gui = null;

    if (this.svg) {
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
    if (this.murrelet == null) {
      return
    }

    if (!isNaN(Number(bpm))) {
      this.murrelet.set_bpm(bpm);
    }
  }

  set_beats_per_bar(beats_per_bar) {
    if (this.murrelet == null) {
      return
    }

    if (!isNaN(Number(beats_per_bar))) {
      this.murrelet.set_beats_per_bar(bpm);
    }
  }

  // optionally set up a gui to update the drawing config
  async setup_gui(
    gui_div,
    {
      schema_hints = {},
      url_param_key = "conf",
      sketch_name = null,
      set_config_callback = null,
    } = {}
  ) {
    let drawingConf = try_to_get_conf_from_url(url_param_key);

    const uninitialized_error_msg =
      "Can't set up the GUI without an example of the drawing config! Call `this.set_config_json(conf)` before calling this!";

    if (!drawingConf) {
      if (this.init_conf) {
        drawingConf = this.init_conf;
      } else {
        console.error(uninitialized_error_msg);
      }
    }

    if (this.murrelet === null) {
      console.error(uninitialized_error_msg);
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

      this.gui = new MurreletGUI(this, editor, errmsg, {
        url_param_key,
        sketch_name,
      });
      await this.gui.init(schema_hints);
      this.gui.build_html(drawingConf);

      submit_button.onclick = async () => {
        await this.gui.update();
      };

      editor.addEventListener("keydown", async (event) => {
        if (event.metaKey && event.key === "Enter") {
          await this.gui.update();
        }
      });

      this.set_config_callback = set_config_callback;

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
    return new Dovekie();
  }

  async set_config(drawingConf) {
    // we don't support hashmaps yet, so just convert to vec

    function convert_item(value) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // step one, if it's another struct
        return Object.entries(value).map(([key, value]) => {
          return { key: key, value: convert_item(value) };
        });
      } else if (Array.isArray(value)) {
        // if it's an array
        return value.map((element) => convert_item(element));
      } else if (typeof value === "number") {
        // it's a number, return as is
        return value;
      } else if (!isNaN(parseFloat(value))) {
        // if it can be parsed as a float, return the float
        return parseFloat(value);
      } else {
        // console.error("unexpected type", value);
        return value; // this should be a function hopefully!
      }
    }

    const convertedConf = convert_item(drawingConf);
    // console.log(convertedConf);

    const conf = { data: convertedConf };

    try {
      await this.reload(conf);
    } catch (err_msg) {
      console.log(JSON.stringify(drawingConf));
      console.log("error from drawing conf:", err_msg);

      return { is_success: false, err_msg };
    }

    console.log("success!");
    this.update({}); // we leave custom variables alone
    this.init_conf = drawingConf;

    if (this.set_config_callback) {
      // doing extra work here but maybe that'll make sure it's consistent!
      this.set_config_callback(this.params());
    }

    return { is_success: true };
  }

  async initModel(conf, opts = {}) {
    let { custom_model } = opts;

    let model_func;
    if (custom_model) {
      model_func = custom_model;
    } else {
      model_func = new_model;
    }

    // if we haven't successfully loaded it, try to do that
    console.log("attempting to initialize model!");
    try {
      if (typeof conf !== "string") {
        conf = JSON.stringify(conf);
      }

      try {
        const model = await model_func(conf);
        this.murrelet = model;
        console.log("model successfully initialized!");
      } catch (e) {
        console.error("error initializing with configuration", conf, e);
        const msg = (e && e.message) ? e.message : String(e);
        document.getElementById("err_msg").innerHTML = msg;
      }

    } catch (err) {
      console.error("init failed", err);
    }
  }

  paths() {
    return this.svg.getElementsByClassName("paths")[0];
  }

  apply_cmd(cmd) {
    if (this.murrelet !== null) {
      return this.murrelet.apply_cmd(cmd);
    }
  }

  // can throw exception
  async reload(conf) {
    const confstr = JSON.stringify(conf);

    if (this.murrelet === null) {
      await this.initModel(confstr);
    }

    if (this.murrelet !== null) {
      // will error if this is invalid, so be sure to catch it
      this.murrelet.set_config_json(confstr);

      // this.fps = this.murrelet.fps();
      this.updateWindowSize();
    }
  }

  ////////
  // update the app configs
  updateWindowSize() {
    if (this.svg) {
      const rect = this.svg.getBoundingClientRect();
      let win_x = rect.width;
      let win_y = rect.height;

      this.murrelet.set_window_dims(win_x, win_y);
    }
  }

  mouseMove(event) {
    if (this.svg && this.murrelet) {
      const rect = this.svg.getBoundingClientRect();
      // Calculate the x and y coordinates relative to the container
      let mouse_x = event.clientX - rect.left;
      let mouse_y = event.clientY - rect.top;

      this.murrelet.set_mouse_position(mouse_x, mouse_y);
    }
  }

  mouseDown() {
    if (this.murrelet !== null) {
      this.murrelet.set_mouse_left_is_down();
    }
  }

  mouseUp() {
    if (this.murrelet !== null) {
      this.murrelet.set_mouse_left_is_up();
    }
  }

  ////////


  state() {
    if (this.murrelet !== null) {
      return this.murrelet.state();
    }
  }

  set_custom_variables(vs) {
    if (this.murrelet == null) {
      return
    }

    for (const [k, v] of Object.entries(vs)) {
      this.murrelet.set_custom_var(k, v);
    }


  }

  // todo, make sure that callers call set_custom_vars ahead of time.
  // update({ custom_variables = null } = {}) {

  update() {
    if (this.murrelet !== null) {
      this.murrelet.tick();

      // if we have a gui, update the values every few frames
      if (this.murrelet.frame() % 5n == 0n && this.gui) {
        this.gui.update_values();
      }

      // update the variables that depend on when updates happen!
      this.lastUpdate = performance.now();
    }
  }

  // make sure data is in row-major order! it should always have the same length
  set_raft(fields, data) {
    if (this.murrelet == null) {
      return
    }

    let f32 = new Float32Array(data.flat());
    this.murrelet.set_data(fields, f32);
  }

  compute_raft() {
    const len = this.murrelet.o_many();          // f32 count (row_count * stride)
    const ptr = this.murrelet.raft_out_ptr();    // byte offset
    const stride = this.murrelet.raft_stride();
    const paths = JSON.parse(this.murrelet.raft_leaf_paths_json());

    const flatView = new Float32Array(getWasm().memory.buffer, ptr, len);

    const flat = flatView.slice();

    return new RaftResult(flat, stride, paths);
  }

  params() {
    const raw = JSON.parse(this.murrelet.get_config_json()).data;

    // recursively go through and parse back into the structure
    // it'll either be a struct (list with {key, value}), a vec (a list), or a float.
    function parseParams(data) {
      if (Array.isArray(data)) {
        if (data.length === 0) {
          return [];
        }
        // if it's looking like a struct
        if (
          typeof data[0] === "object" &&
          "key" in data[0] && // hm this will bite us if user-defined values are key/value, maybe should use a funkier name?
          "value" in data[0]
        ) {
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
