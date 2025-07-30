import init, { new_model } from "./rust/pkg/dovekie.js";
import wasmUrl from "./rust/pkg/dovekie_bg.wasm?url";

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

    // init some things about the mouse
    this.mouse_x = 0.0; // mouse x
    this.mouse_y = 0.0; // mouse y
    this.mouse_down = false;

    // init some things about the window (will update soon)
    this.dim_x = 600.0; // will be w
    this.dim_y = 600.0; // will be h

    // init frame count
    this.frame = 1n;

    // initial, but once we successfully load the model we'll update this

    this.fps = 30; // initial, but we'll load this from the config
    this.lastUpdate = performance.now();

    if (svg) {
      console.log("adding event listeners to ", this.svg);
      this.addEventListeners();
    } else {
      console.log("undefined svg, not adding event listeners")
    }
  }

  addEventListeners() {
    this.svg.addEventListener("mousemove", () => this.mouseMove);
    this.svg.addEventListener("click", () => this.mouseDown);
    this.svg.addEventListener("mouseup", () => this.mouseUp);

    window.addEventListener("resize", () => this.updateWindowSize);
    document.addEventListener("DOMContentLoaded", () => this.updateWindowSize);
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
    let errMsg = await this.reload(conf);

    if (errMsg != "" && errMsg != "Success!") {
      console.log(JSON.stringify(drawingConf));
      console.log("error from drawing conf:", errMsg);

      return false;
    } else {
      this.update();
      return true;
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

  updateMurreletWithWorld() {
    if (this.murrelet !== null) {
      this.murrelet.update_frame(
        this.frame,
        this.dim_x,
        this.dim_y,
        this.mouse_x,
        this.mouse_y,
        this.mouse_down
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
    console.log("move! svg is", this.svg);

    if (this.svg) {
      const rect = this.svg.getBoundingClientRect();
      console.log("murrelet selecting a box!", rect);

      // Calculate the x and y coordinates relative to the container
      this.mouse_x = event.clientX - rect.left;
      this.mouse_y = event.clientY - rect.top;
    }
  }

  mouseDown() {
    this.mouseDown = true;
  }

  mouseUp() {
    this.mouseDown = false;
  }

  state() {
    if (this.murrelet !== null) {
      return this.murrelet.state();
    }
  }

  update() {
    if (this.murrelet !== null) {
      const t = performance.now();

      // You _could_ set up FPS, but I'm building this with the assumption folks
      // won't set realtime=false, so we'll just run as fast as we can
      // something like `t - this.lastUpdate > 1000 / this.fps`
      this.updateMurreletWithWorld();

      this.lastUpdate = t;

      this.frame += 1n;
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
