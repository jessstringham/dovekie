// chatgpt
function dehydrate(obj, prefix = "") {
  const out = {};

  function walk(node, path) {
    if (node !== null && typeof node === "object") {
      if (Array.isArray(node)) {
        node.forEach((val, i) => walk(val, `${path}.${i}`));
      } else {
        for (const [k, val] of Object.entries(node)) {
          walk(val, `${path}.${k}`);
        }
      }
    } else {
      out[path] = node;
    }
  }

  walk(obj, prefix);
  return out;
}

export class ValuesHistory {
  constructor() {
    this.values = [];
    this.max_history_per_value = 36;
  }

  find_sparklines() {
    const sparklines = document.body.querySelectorAll(
      "[data-sparkline-rust-path]"
    );

    const sparkline_list = Array.from(sparklines).map((el) => ({
      element: el,
      path: el.getAttribute("data-sparkline-rust-path"),
      kind: el.getAttribute("data-sparkline-kind"),
    }));

    return sparkline_list;
  }

  update_sparklines() {
    // first find the sparklines
    let sparklines = this.find_sparklines();

    sparklines.forEach(({ element, path, kind }) => {
      const history = this.values
        .map((v) => {
          return v[path];
        })
        .filter((v) => v !== undefined);

      element.innerHTML = "";

      draw_sparkline(element, history, kind);
    });
  }

  update(params) {
    while (this.values.length >= this.max_history_per_value) {
      this.values.shift(); // drop the oldest
    }
    this.values.push(dehydrate(params));

    this.update_sparklines();
  }
}

function draw_sparkline(container, data, type) {
  const span = document.createElement("span");
  span.style.color = "aquamarine";
  span.style.fontFamily = "monospace";
  span.style.textAlign = "right";
  span.style.width = "5ch";
  span.style.display = "inline-block";
  span.style.verticalAlign = "middle";
  span.style.fontStyle = "italic";
  span.style.fontSize = "0.8em";
  span.style.lineHeight = "1";
  span.style.verticalAlign = "middle";
  span.style.marginLeft = "4px";
  let last = data[data.length - 1];
  if (typeof last === "number") {
    // Format to always 5 chars, moving decimal as needed
    if (Math.abs(last) >= 10000) {
      last = last.toExponential(2).padStart(5, " ");
    } else {
      last = last.toPrecision(5).replace(/\.?0+$/, "");
      if (last.length > 5) last = last.slice(0, 5);
      last = last.padStart(5, " ");
    }
  } else if (last !== undefined && last !== null) {
    last = String(last).slice(0, 5).padStart(5, " ");
  } else {
    last = "     ";
  }
  span.textContent = ` ${last}`;

  if (data.length > 0) {
    if (type === "num") {
      let svg = sparkline(data);
      svg.style.display = "inline-block";
      svg.style.verticalAlign = "middle";
      container.appendChild(svg);
    }
    // } else if (type === "v2") {
    //   const svg = d3
    //     .create("svg")
    //     .attr("width", 32)
    //     .attr("height", 32)
    //     .style("margin-left", "10px");

    //   const xExtent = d3.extent(this.data, (d) => d.x);
    //   const yExtent = d3.extent(this.data, (d) => d.y);

    //   const dataRange = Math.max(
    //     xExtent[1] - xExtent[0],
    //     yExtent[1] - yExtent[0]
    //   );

    //   const x = d3
    //     .scaleLinear()
    //     .domain([xExtent[0], xExtent[0] + dataRange])
    //     .range([2, 30]);

    //   const y = d3
    //     .scaleLinear()
    //     .domain([yExtent[0], yExtent[0] + dataRange])
    //     .range([30, 2]);

    //   const line = d3
    //     .line()
    //     .x((d) => x(d.x))
    //     .y((d) => y(d.y));

    //   svg
    //     .append("path")
    //     .datum(this.data)
    //     .attr("fill", "none")
    //     .attr("stroke", "aquamarine")
    //     .attr("stroke-width", 1.5)
    //     .attr("d", line);

    //   svg
    //     .append("circle")
    //     .datum(this.data[data.length - 1])
    //     .attr("cx", (d) => x(d.x))
    //     .attr("cy", (d) => y(d.y))
    //     .attr("r", 2)
    //     .attr("fill", "aquamarine");

    //   container.appendChild(svg.node());
    // } else if (type === "rgb") {
    //   const svg = d3
    //     .create("svg")
    //     .attr("width", 48)
    //     .attr("height", 12)
    //     .style("margin-left", "10px");

    //   svg
    //     .selectAll("rect")
    //     .data(this.data)
    //     .enter()
    //     .append("rect")
    //     .attr("x", (_d, i) => 3 * i)
    //     .attr("y", 0.0)
    //     .attr("width", 1.5)
    //     .attr("height", 12)
    //     .attr("fill", (d) => {
    //       const l = `rgb(${Math.floor(d.r * 255)}, ${Math.floor(
    //         d.g * 255
    //       )}, ${Math.floor(d.b * 255)})`;
    //       console.log(l);
    //       return l;
    //     });

    //   svg
    //     .append("circle")
    //     .datum(this.data[data.length - 1])
    //     .attr("cx", (d) => data.length * 1.5)
    //     .attr("cy", (d) => 0.0)
    //     .attr("width", 24)
    //     .attr("height", 12)
    //     .attr("fill", (d) => {
    //       const l = `rgb(${Math.floor(d.r * 255)}, ${Math.floor(
    //         d.g * 255
    //       )}, ${Math.floor(d.b * 255)})`;
    //       console.log(l);
    //       return l;
    //     });

    //   container.appendChild(svg.node());
    // } else if (type === "hsva") {
    //   const svg = d3
    //     .create("svg")
    //     .attr("width", 48)
    //     .attr("height", 12)
    //     .style("margin-left", "10px");

    //   svg
    //     .selectAll("rect")
    //     .data(this.data)
    //     .enter()
    //     .append("rect")
    //     .attr("x", (_d, i) => 3 * i)
    //     .attr("y", 0.0)
    //     .attr("width", 1.5)
    //     .attr("height", 12)
    //     .attr("fill", (d) => {
    //       return `hsla(${d.h * 360}, ${d.s * 100}%, ${d.v * 100}%, ${d.a})`;
    //     });

    //   svg
    //     .append("circle")
    //     .datum(data[data.length - 1])
    //     .attr("cx", data.length * 1.5)
    //     .attr("cy", 0.0)
    //     .attr("width", 24)
    //     .attr("height", 12)
    //     .attr("fill", (d) => {
    //       return `hsla(${d.h * 360}, ${d.s * 100}%, ${d.v * 100}%, ${d.a})`;
    //     });

    //   container.appendChild(svg.node());
    // }
  }

  container.appendChild(span);

  return container;
}

// chatgpt
function sparkline(data) {
  const W = 32,
    H = 16,
    PAD_TOP = 1,
    PAD_BOTTOM = 1;
  const svgNS = "http://www.w3.org/2000/svg";

  // Create SVG
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);

  if (!data || data.length === 0) {
    container.appendChild(svg);
    console.log("too short");
    return svg;
  }

  // X scale
  const xs = (i) => (data.length === 1 ? 0 : (i / (data.length - 1)) * W);

  // Y scale
  let min = +Infinity,
    max = -Infinity;
  for (const d of data) {
    const v = d;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const yRangeTop = PAD_TOP;
  const yRangeBottom = H - PAD_BOTTOM;
  const ys = (v) => {
    if (max === min) return (yRangeTop + yRangeBottom) / 2;
    const t = (v - min) / (max - min); // 0..1
    return yRangeBottom - t * (yRangeBottom - yRangeTop);
  };

  // Path string
  let d = "";
  for (let i = 0; i < data.length; i++) {
    const x = xs(i);
    const y = ys(data[i]);
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
  }

  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "aquamarine");
  path.setAttribute("stroke-width", "1.5");
  svg.appendChild(path);

  return svg;
}
