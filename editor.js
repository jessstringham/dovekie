import { ValuesHistory } from "./sparklines.js";

class ConfigHistory {
  constructor(sketch_name = "") {
    this.local_storage_name = "dovekie_config_history";
    if (sketch_name) {
      this.local_storage_name = `${this.local_storage_name}.${sketch_name}`;
    }

    this.history = JSON.parse(
      localStorage.getItem(this.local_storage_name) || "[]"
    );
  }

  clear() {
    this.history = [];
    this.save();
  }

  save() {
    localStorage.setItem(this.local_storage_name, JSON.stringify(this.history));
  }

  push(conf) {
    let time = Date.now();
    this.history.push({
      name: null,
      conf,
      time,
      id: `${time}-${Math.random().toString(36).substring(2, 7)}`,
    });
    this.save();
  }

  pop() {
    if (this.history.length > 0) {
      const item = this.history.pop();
      this.save();
      return item;
    }
    return undefined;
  }

  last() {
    if (this.history.length > 0) {
      return this.history[this.history.length - 1];
    }
    return undefined;
  }

  get length() {
    return this.history.length;
  }

  rename_item(id, new_name) {
    const item = this.history.find((item) => item.id === id);
    if (item) {
      item.name = new_name;
      this.save();
    } else {
      console.error("no item with id", id);
    }
  }

  view() {
    return [...this.history].sort((a, b) => b.time - a.time);
  }
}

export function rehydrate(flattenedVals) {
  let result = {};

  // console.log("rehydrating", flattenedVals);

  for (let i = 0; i < flattenedVals.length; i++) {
    let key = flattenedVals[i].path;
    let value = flattenedVals[i].value;

    let split_key = key.split(".").slice(1);

    let current = result; // always start at the top

    let key_i = 0;
    while (key_i < split_key.length - 1) {
      let key_name = split_key[key_i];
      const is_list = isInt(key_name);
      if (is_list) {
        key_name = parseInt(key_name);
      }
      const next_type_is_list = isInt(split_key[key_i + 1]);

      if (is_list) {
        for (let iii = current.length; iii <= key_name; iii++) {
          if (next_type_is_list) {
            current.push([]);
          } else {
            current.push({});
          }
        }
      } else {
        if (!(key_name in current)) {
          if (next_type_is_list) {
            current[key_name] = [];
          } else {
            current[key_name] = {};
          }
        }
      }

      current = current[key_name];

      key_i += 1;
    }

    if (value != undefined) {
      let last_val = split_key[split_key.length - 1];

      const is_list = Number.isInteger(parseInt(last_val));
      if (is_list) {
        last_val = parseInt(last_val);
      }

      current[last_val] = value;
    }
  }

  return result;
}

function make_div(parent, cls) {
  const div = document.createElement("div");
  if (cls) {
    let split_cls = cls.split(" ");
    for (let i = 0; i < split_cls.length; i++) {
      div.classList.add(split_cls[i]);
    }
  }
  parent.appendChild(div);
  return div;
}

function make_textarea_input(parent, cls, rustid, val) {
  const div = document.createElement("textarea");
  div.setAttribute("data-rust-path", rustid);
  div.classList.add(cls);
  div.value = val;
  parent.appendChild(div);
  return div;
}

function make_input(parent, cls, rustid, val) {
  const div = document.createElement("input");
  div.setAttribute("data-rust-path", rustid);
  div.classList.add(cls);
  div.type = "text";
  div.value = val;
  parent.appendChild(div);
  return div;
}

function make_span(parent, clss, text) {
  const div = document.createElement("span");
  const classes = clss.split(" ");
  for (let i = 0; i < classes.length; i++) {
    div.classList.add(classes[i]);
  }
  div.innerText = text;
  parent.appendChild(div);
  return div;
}

function make_selection(parent, cls, rustid, values, selectedValue) {
  const div = document.createElement("select");
  div.setAttribute("data-rust-path", rustid);
  div.classList.add(cls);
  parent.appendChild(div);

  for (let v = 0; v < values.length; v++) {
    const option = document.createElement("option");
    option.value = values[v];
    option.innerText = values[v];
    if (values[v] == selectedValue) {
      option.selected = true;
    }
    div.appendChild(option);
  }

  div.addEventListener("change", function () {
    setViewedSelection(this.value, parent);
  });

  return div;
}

function isInt(num) {
  return Number.isInteger(parseInt(num));
}

function setViewedSelection(selection, parent) {
  const choices = parent.querySelectorAll(".enum-choice");

  choices.forEach((choice) => {
    const choice_value = choice.getAttribute("data-rust-path-enum-choice");

    const choiceInputs = choice.querySelectorAll("input, textarea");

    if (choice_value == selection) {
      choice.classList.remove("collapsed");
      choice.classList.add("expanded");

      choiceInputs.forEach((x) => {
        x.setAttribute("data-rust-path-inactive", false);
      });
    } else {
      choice.classList.add("collapsed");

      choiceInputs.forEach((x) => {
        x.setAttribute("data-rust-path-inactive", true);
      });
    }
  });
}

function make_add_button(div) {
  const button = document.createElement("button");
  button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="12" y1="4" x2="12" y2="20" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="4" y1="12" x2="20" y2="12" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>`;
  button.type = "button";
  button.classList.add("list-add");

  div.appendChild(button);
  return button;
}

function add_label(div, labelText) {
  const label = document.createElement("label");
  label.textContent = labelText + ":";
  div.appendChild(label);
}

function make_collapse_label(div, label) {
  const structName = make_div(div, "subtle-label");
  structName.textContent = label;
  return structName;
}

function make_delete_button(div) {
  const button = document.createElement("button");
  button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="4" y1="4" x2="20" y2="20" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="20" y1="4" x2="4" y2="20" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>`;
  button.type = "button";
  button.classList.add("struct-delete");

  div.appendChild(button);
  return button;
}

function path_to_id(path) {
  return path.replace(/[{}.\[\]]/g, (match) => {
    switch (match) {
      case "{":
        return "";
      case "}":
        return "";
      case "[":
        return "";
      case "}":
        return "";
      case ".":
        return "-";
      default:
        return match;
    }
  });
}

function make_thing_toggle_other(toggling, toggled) {
  toggling.addEventListener("click", function (event) {
    event.preventDefault();

    if (toggled.classList.contains("expanded")) {
      toggled.classList.remove("expanded");
      toggled.classList.add("collapsed");
    } else {
      toggled.classList.remove("collapsed");
      toggled.classList.add("expanded");
    }
  });
}

async function build_html(div, parsed_gui_schema, drawingConf) {
  div.innerHTML = "";
  // since this is (hopefully) valid, init the history with this
  add_item(div, [], parsed_gui_schema, drawingConf, {});

  div.querySelectorAll("input, textarea").forEach((input) => {
    input.addEventListener("click", function () {
      this.select();
    });
  });

  div.querySelectorAll(".struct-or-enum").forEach((input) => {
    const thisdiv = div;
    input.addEventListener("mousemove", function (event) {
      // use hover to figure out the most narrow item
      const hoveredElements = div.querySelectorAll(".struct-or-enum:hover");

      thisdiv
        .querySelectorAll(".struct-or-enum.selected-struct-or-enum")
        .forEach((el) => {
          el.classList.remove("selected-struct-or-enum");
        });

      if (hoveredElements.length > 0) {
        hoveredElements[hoveredElements.length - 1].classList.add(
          "selected-struct-or-enum"
        );
      }
    });
  });
}

function add_struct_field(
  parentDiv,
  parentPath,
  parentSchema,
  parentInitValue,
  args
) {
  let [fieldName, fieldValue] = parentSchema;

  if (fieldValue == "Skip") {
    return;
  }

  const rustPath = parentPath + "." + fieldName;

  const div = make_div(parentDiv, "struct-field");
  add_label(div, fieldName);

  let initValue;
  if (parentInitValue && fieldName in parentInitValue) {
    initValue = parentInitValue[fieldName];
  }

  add_item(div, rustPath, fieldValue, initValue, args);
}

function add_struct(
  parentDiv,
  parentPath,
  parentSchema,
  parentInitValue,
  args
) {
  let [name, fields] = parentSchema;

  const path = parentPath;

  let divClass = "struct struct-or-enum";
  if (args.isEnumItem) {
    divClass = "struct-in-enum";
  }

  const div = make_div(parentDiv, divClass);

  const controlDiv = make_div(div, "control-tools");
  const collapse = make_collapse_label(controlDiv, name);

  if ("isDeletableIdx" in args) {
    const deleteButton = make_delete_button(controlDiv);

    const [deleteParentDiv, deleteParentPath, deleteParentSchema, deleteIdx] =
      args["isDeletableIdx"];

    deleteButton.addEventListener("click", () => {
      delete_list_item_at(
        deleteParentDiv,
        deleteParentPath,
        deleteParentSchema,
        deleteIdx
      );
    });

    deleteButton.addEventListener("mouseenter", () => {
      deleteButton.closest("div.struct")?.classList.add("delete-warning");
    });

    deleteButton.addEventListener("mouseleave", () => {
      deleteButton.closest("div.struct")?.classList.remove("delete-warning");
    });
    // now remove deletable for children
    delete args["isDeletableIdx"];
  }

  const editArrow = make_span(collapse, "collapsed");
  editArrow.innerText = "...";

  const structEdit = make_div(div, "expanded");

  for (let i = 0; i < fields.length; i++) {
    add_struct_field(structEdit, path, fields[i], parentInitValue, args);
  }

  make_thing_toggle_other(collapse, structEdit);
  make_thing_toggle_other(collapse, editArrow);

  return div;
}

function add_enum(parentDiv, parentPath, parentSchema, parentInitValue, args) {
  let [name, fields, is_untagged] = parentSchema;
  // console.log("is untagged", name, is_untagged);

  // we'll just have a "type" input
  const divClass = "enum struct-or-enum";
  const div = make_div(parentDiv, divClass);

  const controlDiv = make_div(div, "control-tools");
  const collapse = make_collapse_label(controlDiv, name);
  const editArrow = make_span(collapse, "collapsed");
  editArrow.innerText = "...";
  if ("isDeletableIdx" in args) {
    const [deleteParentDiv, deleteParentPath, deleteParentSchema, deleteIdx] =
      args["isDeletableIdx"];
    const deleteButton = make_delete_button(controlDiv);
    deleteButton.addEventListener("click", () => {
      delete_list_item_at(
        deleteParentDiv,
        deleteParentPath,
        deleteParentSchema,
        deleteIdx
      );
    });

    deleteButton.addEventListener("mouseenter", () => {
      deleteButton.closest(`div.${divClass}`)?.classList.add("delete-warning");
    });

    deleteButton.addEventListener("mouseleave", () => {
      deleteButton
        .closest(`div.${divClass}`)
        ?.classList.remove("delete-warning");
    });
    delete args["isDeletableIdx"]; // we have the delete button, so nothing else should get it
  }

  // the enum wrapper will be collapsed, the enum edit will get swapped out
  const enumWrapper = make_div(div, "expanded");

  add_label(enumWrapper, "type");

  let fieldNames = [];
  let correctedFields = [];

  for (let i = 0; i < fields.length; i++) {
    let field = fields[i];
    if ("Unnamed" in field) {
      field = field["Unnamed"];
      correctedFields.push(field);
      fieldNames.push(field[0]);
    }
    if ("Unit" in field) {
      field = field["Unit"];
      correctedFields.push(field);
      fieldNames.push(field);
    }
  }

  let defaultType;
  let selectionPath;
  if (is_untagged) {
    defaultType = parentInitValue;
    selectionPath = parentPath;
  } else {
    defaultType = parentInitValue && parentInitValue["type"];
    selectionPath = parentPath + ".type";
  }

  defaultType = defaultType || fieldNames[0];

  const selection = make_selection(
    enumWrapper,
    "enum-selector",
    selectionPath,
    fieldNames,
    defaultType
  );

  const enumEdit = make_div(enumWrapper, "enum-edit");
  for (let i = 0; i < correctedFields.length; i++) {
    // console.log("corrected", correctedFields[i]);

    let enumName;
    let contents;
    if (correctedFields[i].length == 2) {
      enumName = correctedFields[i][0];
      contents = correctedFields[i][1];
    } else if (correctedFields[i].length == 1) {
      enumName = correctedFields[i];
    } else {
      // console.log("corrected fields", correctedFields[i]);
    }

    const enumChoiceWrapper = make_div(enumEdit, "enum-choice");

    enumChoiceWrapper.setAttribute("data-rust-path-enum-choice", enumName);

    // if it contains a struct...
    if (contents) {
      // if it's not the right type, overwrite the init value
      let initValue;
      if (enumName == defaultType) {
        initValue = parentInitValue;
      }
      const div = add_item(
        enumChoiceWrapper,
        parentPath, // add the same parent as type's, so we flatten
        contents,
        initValue,
        { ...args, isEnumItem: true }
      );
    }
  }

  setViewedSelection(defaultType, enumWrapper);

  make_thing_toggle_other(collapse, enumWrapper);
  make_thing_toggle_other(collapse, editArrow);
}

function insert_list_item_at(parentDiv, parentPath, schema, idx) {
  // okay, pull up all of the items, and save their current contents
  let origSnapshot = extract_rust_data(parentDiv);

  let snapshot = [];

  for (let i = 0; i < origSnapshot.length; i++) {
    let v = origSnapshot[i];

    let newPath = v.path.replace(
      new RegExp(`(${parentPath}\\.)\\d+`),
      (match, p1) => {
        // i get by with a little help from chatgpt
        const number = parseInt(match.replace(p1, ""), 10);
        if (number >= idx) {
          return `.dummy.${number + 1}`;
        } else {
          return `.dummy.${number}`;
        }
      }
    );

    // if there's no number, replace it too
    if (newPath == parentPath) {
      newPath = ".dummy";
    }

    if (!newPath.startsWith(".dummy")) {
      throw new Error(`${newPath} did not start with ${parentPath}`);
    }

    snapshot.push({
      path: newPath,
      value: v.value,
    });
  }

  // and add our blank one, which it'll fill up with defaults when it adds the item.
  snapshot.push({
    path: `.dummy.${idx}`,
    value: {},
  });

  const newDefaults = rehydrate(snapshot);

  parentDiv.innerHTML = "";

  add_list(parentDiv, parentPath, schema, newDefaults.dummy);

  // and now add the new items
}

function delete_list_item_at(parentDiv, parentPath, schema, idx) {
  // this one's like insert but easier, we grab the snapshot
  // filter out items with parentPath as prefix
  // and then decrease all the indices

  // okay, pull up all of the items, and save their current contents
  let origSnapshot = extract_rust_data(parentDiv);

  let snapshot = [];

  for (let i = 0; i < origSnapshot.length; i++) {
    let v = origSnapshot[i];

    if (v.path.startsWith(parentPath + "." + idx)) {
      // deleted!
    } else {
      let newPath = v.path.replace(
        new RegExp(`(${parentPath}\\.)\\d+`),
        (match, p1) => {
          const number = parseInt(match.replace(p1, ""), 10);
          if (number >= idx) {
            console.log("moving down", number);
            return `.dummy.${number - 1}`;
          } else {
            console.log("leaving", number, "alone");
            return `.dummy.${number}`;
          }
        }
      );

      // if there's no number, replace it too
      if (newPath == parentPath) {
        newPath = ".dummy";
      }

      if (!newPath.startsWith(".dummy")) {
        throw new Error(`${newPath} did not start with ${parentPath}`);
      }

      snapshot.push({
        path: newPath,
        value: v.value,
      });
    }
  }

  const newDefaults = rehydrate(snapshot);

  parentDiv.innerHTML = "";

  add_list(parentDiv, parentPath, schema, newDefaults.dummy);

  // and now add the new items
}

function add_list(parentDiv, parentPath, parentSchema, parentInitValue, args) {
  const path = parentPath;

  const wrapper = make_div(parentDiv); // todo, this one is causing new item to insert divs..

  const div = make_div(wrapper, "list");
  div.setAttribute("data-rust-path", path);
  div.setAttribute("data-rust-value-override", "[]");
  const collapse = make_collapse_label(div, "");
  const editArrow = make_span(collapse, "collapsed");
  editArrow.innerText = "...";

  const listEdit = make_div(div, "expanded");

  const addButtonBeginning = make_add_button(listEdit, 0);
  addButtonBeginning.addEventListener("click", () => {
    insert_list_item_at(wrapper, path, parentSchema, 0);
  });

  let initValue = parentInitValue || [];

  for (let i = 0; i < initValue.length; i++) {
    // in this case, the schema is the same as before
    // here we go, each item of a list is deletable
    const newArgs = {
      ...args,
      isDeletableIdx: [wrapper, path, parentSchema, i],
    };
    add_item(listEdit, path + "." + i, parentSchema, initValue[i], newArgs);
    const addButton = make_add_button(listEdit, i + 1);
    addButton.addEventListener("click", () => {
      insert_list_item_at(wrapper, path, parentSchema, i + 1);
    });
  }

  make_thing_toggle_other(collapse, listEdit);
  make_thing_toggle_other(collapse, editArrow);
}

function input_val_num(parentDiv, rust_id, parentInitValue) {
  let wrapper = make_div(parentDiv, "val-num-flex");
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "8px";
  wrapper.style.width = "100%";
  wrapper.style.height = "100%";

  // todo, it'd be nice if this was all over in sparklines...
  let sparkline = make_div(wrapper, "val-num-sparkline");
  sparkline.style.background = "#464646ff";
  sparkline.style.width = "80px";
  sparkline.style.height = "20px";
  sparkline.setAttribute("data-sparkline-rust-path", rust_id);
  sparkline.setAttribute("data-sparkline-kind", "num");

  make_input(wrapper, "val-num", rust_id, parentInitValue || 0.0);

  return wrapper;
}

function input_val_bool(parentDiv, parentPath, parentInitValue) {
  make_input(parentDiv, "val-bool", parentPath, parentInitValue || false);
}

function input_val_vec2(parentDiv, parentPath, parentInitValue) {
  if (parentInitValue == undefined) {
    parentInitValue = [0.0, 0.0];
  }

  make_span(parentDiv, "val-vec2-label", "(");
  make_input(parentDiv, "val-vec2", parentPath + ".0", parentInitValue[0]);
  make_span(parentDiv, "val-vec2-label", ",");
  make_input(parentDiv, "val-vec2", parentPath + ".1", parentInitValue[1]);
  make_span(parentDiv, "val-vec2-label", ")");
}

function input_val_angle(parentDiv, parentPath, parentInitValue) {
  make_input(parentDiv, "val-angle", parentPath, parentInitValue || 0.0);
}

function input_val_defs(parentDiv, parentPath, parentInitValue) {
  make_textarea_input(parentDiv, "val-def", parentPath, parentInitValue || "");
}

function input_ref_defs(parentDiv, parentPath, parentInitValue) {
  // todo, have this update all of them..
  make_input(parentDiv, "val-ref", parentPath, parentInitValue || "a");
}

function input_val_color(parentDiv, parentPath, parentInitValue) {
  // todo, have this update all of them..
  // make_dummy_input(parentDiv, "val-color", parentPath, parentInitValue);
  make_span(parentDiv, "val-color-label", "[");

  let initValue = parentInitValue;
  if (parentInitValue == undefined) {
    initValue = [0.0, 0.0, 1.0, 1.0];
  }

  // secretly we'll always do hsv
  make_input(
    parentDiv,
    "val-color",
    parentPath + ".0",
    initValue[0],
    path_to_id(parentPath) + "h"
  );
  make_span(parentDiv, "val-color-label", ",");

  make_input(
    parentDiv,
    "val-color",
    parentPath + ".1",
    initValue[1],
    path_to_id(parentPath) + "s"
  );
  make_span(parentDiv, "val-color-label", ",");

  make_input(
    parentDiv,
    "val-color",
    parentPath + ".2",
    initValue[2],
    path_to_id(parentPath) + "v"
  );
  make_span(parentDiv, "val-color-label", ",");

  make_input(
    parentDiv,
    "val-color",
    parentPath + ".3",
    initValue[3],
    path_to_id(parentPath) + "a"
  );
  make_span(parentDiv, "val-color-label", ")");
}

function add_val(parentDiv, parentPath, parentSchema, parentInitValue, args) {
  if (parentSchema == "Num") {
    const divClass = "val-num-container";
    const div = make_div(parentDiv, divClass);
    maybe_add_delete(div, args, divClass);
    input_val_num(div, parentPath, parentInitValue);
  } else if (parentSchema == "Bool") {
    const div = make_div(parentDiv, "val-bool-container");
    input_val_bool(div, parentPath, parentInitValue);
  } else if (parentSchema == "Vec2") {
    const divClass = "val-vec2-container";
    const div = make_div(parentDiv, divClass);
    maybe_add_delete(div, args, divClass);
    input_val_vec2(div, parentPath, parentInitValue);
  } else if (parentSchema == "Angle") {
    const div = make_div(parentDiv, "val-angle-container");
    input_val_angle(div, parentPath, parentInitValue);
  } else if (parentSchema == "Color") {
    const div = make_div(parentDiv, "val-color-container");
    input_val_color(div, parentPath, parentInitValue);
  } else if (parentSchema == "Defs") {
    const div = make_div(parentDiv, "val-defs-container");
    input_val_defs(div, parentPath, parentInitValue);
  } else if (typeof parentSchema === "object" && "Name" in parentSchema) {
    const div = make_div(parentDiv, "val-ref-str-container");
    input_ref_defs(div, parentPath, parentInitValue);
  } else {
    console.log("MISSING VAL", parentSchema);
  }
}

function maybe_add_delete(div, args, divClass) {
  const controlDiv = make_div(div, "control-tools");

  if ("isDeletableIdx" in args) {
    const [deleteParentDiv, deleteParentPath, deleteParentSchema, deleteIdx] =
      args["isDeletableIdx"];
    const deleteButton = make_delete_button(controlDiv);
    deleteButton.addEventListener("click", () => {
      delete_list_item_at(
        deleteParentDiv,
        deleteParentPath,
        deleteParentSchema,
        deleteIdx
      );
    });

    deleteButton.addEventListener("mouseenter", () => {
      deleteButton.closest(`div.${divClass}`)?.classList.add("delete-warning");
    });

    deleteButton.addEventListener("mouseleave", () => {
      deleteButton
        .closest(`div.${divClass}`)
        ?.classList.remove("delete-warning");
    });
    delete args["isDeletableIdx"]; // we have the delete button, so nothing else should get it
  }
}

function add_item(parentDiv, parentPath, parentSchema, parentInitValue, args) {
  if (parentSchema == "Skip") {
    return;
  }

  for (const k in parentSchema) {
    let schema = parentSchema[k];

    if (k == "Struct") {
      parentDiv.classList.add("struct-field-nested");
      return add_struct(parentDiv, parentPath, schema, parentInitValue, args);
    } else if (k == "Enum") {
      parentDiv.classList.add("struct-field-nested");
      return add_enum(parentDiv, parentPath, schema, parentInitValue, args);
    } else if (k == "List") {
      parentDiv.classList.add("struct-field-nested");
      return add_list(parentDiv, parentPath, schema, parentInitValue, args);
    } else if (k == "Val") {
      parentDiv.classList.add("struct-field-val");
      return add_val(parentDiv, parentPath, schema, parentInitValue, args);
    } else if (k == "Skip") {
    } else {
      console.error("Missing item type!", schema);
    }
  }
}

function extract_rust_data(div) {
  function override_to_val(override) {
    if (override == "[]") {
      return [];
    }
  }

  const inputs = div.querySelectorAll("[data-rust-path]");

  const values = Array.from(inputs)
    .filter((input) => {
      if (input.getAttribute("data-rust-path-inactive") == "true") {
        return false;
      } else {
        return true;
      }
    })
    .map((input) => ({
      path: input.getAttribute("data-rust-path"),
      value:
        override_to_val(input.getAttribute("data-rust-value-override")) ||
        input.value,
    }));
  return values;
}

// load up the schema
export class MurreletGUI {
  constructor(
    model,
    div,
    errmsg_div,
    { url_param_key = "conf", sketch_name = "", keep_history = true } = {}
  ) {
    this.model = model;
    this.div = div; // editor div
    this.errmsg_div = errmsg_div;
    this.url_param_key = url_param_key;

    if (keep_history) {
      this.values_history = new ValuesHistory();
    }

    this.config_history = new ConfigHistory(sketch_name);
  }

  async init(schema_hints) {
    if (!schema_hints) {
      schema_hints = {};
    }

    let raw_gui_schema = await this.model.murrelet.gui_schema(
      JSON.stringify(schema_hints)
    );
    this.gui_schema = JSON.parse(raw_gui_schema);
  }

  conf_update(isSuccess) {
    const configElement = document.querySelector("#editor > .struct");

    let cls = "flash-error";
    if (isSuccess) {
      cls = "flash-success";
    }

    if (configElement) {
      configElement.classList.add(cls);

      setTimeout(() => {
        configElement.classList.remove(cls);
      }, 500);
    }
  }

  extract_config() {
    const values = extract_rust_data(this.div);
    return rehydrate(values);
  }

  async build_html(drawingConf) {
    if (!this.gui_schema) {
      // only need to call this once
      //   await this.init();
      console.error("need to call init first!");
    }

    build_html(this.div, this.gui_schema, drawingConf);
  }

  // model should already have frame in it
  // this.editor has the editor
  // this.model has the model
  async undo() {
    let prevConf = this.config_history.pop();
    await this.build_edit_page_from_divs(prevConf.conf);
  }

  update_values() {
    if (this.values_history) {
      this.values_history.update(this.model.params());
    }
  }

  history() {
    return this.config_history.history;
  }

  rename_history(id, new_name) {
    this.config_history.rename_item(id, new_name);
  }

  clear_history() {
    this.config_history.clear();
  }

  async build_edit_page_from_divs(conf) {
    // load the model and update the image
    let err_msg = await this.model.from_drawing_conf(conf);
    if (err_msg) {
      return err_msg;
    }
    this.build_html(conf);
  }

  async update() {
    let drawingConf = this.extract_config();

    // console.log(drawingConf);

    // let conf = { app: defaultApp, drawing: drawingConf };

    // console.log("reloading");
    // let errMsg = await model.reload(conf);
    let { err_msg, is_success } = await this.model.set_config(drawingConf);
    // console.log("done");

    if (is_success) {
      // only update the history if it was successful
      this.config_history.push(drawingConf);

      let confString = JSON.stringify(drawingConf);
      const confUri = encodeURIComponent(confString);

      const params = new URLSearchParams(window.location.search);
      params.set(this.url_param_key, confUri);

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      history.replaceState(null, "", newUrl);

      this.conf_update(true);
      await this.model.update();

      this.errmsg_div.innerText = "";

      return drawingConf;
    } else {
      console.log(err_msg);
      this.conf_update(false);
      this.errmsg_div.innerText = err_msg;
    }
  }
}
