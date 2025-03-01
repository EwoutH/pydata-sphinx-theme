/**
 * Webpack configuration for pydata-sphinx-theme.
 *
 * This script does a few primary things:
 *
 * - Generates a `webpack-macros.html` file that defines macros used
 *   to insert CSS / JS at various places in the main `layout.html` template.
 * - Compiles our SCSS and JS and places them in the _static/ folder
 * - Downloads and links FontAwesome and some JS libraries (Bootstrap, jQuery, etc)
 */

const { resolve } = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const OptimizeCssAssetsPlugin = require("optimize-css-assets-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const dedent = require("dedent");
const { Compilation } = require("webpack");

/*******************************************************************************
 * Paths for various assets (sources and destinations)
 */

const vendorVersions = {fontAwesome: require("@fortawesome/fontawesome-free/package.json").version};

const scriptPath = resolve(__dirname, "src/pydata_sphinx_theme/assets/scripts");
const staticPath = resolve(__dirname,"src/pydata_sphinx_theme/theme/pydata_sphinx_theme/static");
const vendorPath = resolve(staticPath, "vendor");
const faPath = {fontAwesome: resolve(vendorPath, "fontawesome", vendorVersions.fontAwesome)};

/*******************************************************************************
 * functions to load the assets in the html head
 * the css, and js (preload/scripts) are digested for cache busting
 * the fonts are loaded from vendors
 */

function stylesheet(css){ return `<link href="{{ pathto('_static/${css}', 1) }}?digest=${this.hash}" rel="stylesheet">`;}
function preload(js){ return `<link rel="preload" as="script" href="{{ pathto('_static/${js}', 1) }}?digest=${this.hash}">`;}
function script(js){ return `<script src="{{ pathto('_static/${js}', 1) }}?digest=${this.hash}"></script>`;}
function font(woff2){ return `<link rel="preload" as="font" type="font/woff2" crossorigin href="{{ pathto('_static/${woff2}', 1) }}">`;}

/*******************************************************************************
 * the assets to load in the macro
 */
 const theme_stylesheets = [
  "styles/theme.css", // basic sphinx css
  "styles/bootstrap.css", // all bootstrap 5 css with variable adjustments
  "styles/pydata-sphinx-theme.css", // all the css created for this specific theme
];
const theme_scripts = [
  "scripts/bootstrap.js",
  "scripts/pydata-sphinx-theme.js",
];
const fa_stylesheets = [
  `vendor/fontawesome/${vendorVersions.fontAwesome}/css/all.min.css`,
];
const fa_fonts = [
  `vendor/fontawesome/${vendorVersions.fontAwesome}/webfonts/fa-solid-900.woff2`,
  `vendor/fontawesome/${vendorVersions.fontAwesome}/webfonts/fa-brands-400.woff2`,
  `vendor/fontawesome/${vendorVersions.fontAwesome}/webfonts/fa-regular-400.woff2`,
];

/*******************************************************************************
 * Cache-busting Jinja2 macros (`webpack-macros.html`) used in `layout.html`
 *
 * @param  {Compilation} the compilation instace to extract the hash
 * @return {String} the macro to inject in layout.html
 */
function macroTemplate({ compilation }) {

  return dedent(`\
    <!--
      AUTO-GENERATED from webpack.config.js, do **NOT** edit by hand.
      These are re-used in layout.html
    -->
    {# Load FontAwesome icons #}
    {% macro head_pre_icons() %}
      ${fa_stylesheets.map(stylesheet.bind(compilation)).join("\n")}
      ${fa_fonts.map(font).join("\n")}
    {% endmacro %}

    {% macro head_pre_assets() %}
      <!-- Loaded before other Sphinx assets -->
      ${theme_stylesheets.map(stylesheet.bind(compilation)).join("\n")}
    {% endmacro %}

    {% macro head_js_preload() %}
      <!-- Pre-loaded scripts that we'll load fully later -->
      ${theme_scripts.map(preload.bind(compilation)).join("\n")}
    {% endmacro %}

    {% macro body_post() %}
      <!-- Scripts loaded after <body> so the DOM is not blocked -->
      ${theme_scripts.map(script.bind(compilation)).join("\n")}
    {% endmacro %}
  `);
}

/*******************************************************************************
 * Bundle the modules to use them in the theme outputs
 */

const htmlWebpackPlugin = new HtmlWebpackPlugin({
  filename: resolve(staticPath, "webpack-macros.html"),
  inject: false,
  minify: false,
  css: true,
  templateContent: macroTemplate,
});

const copyPlugin = new CopyPlugin([ // fontawesome
  {
    context: "./node_modules/@fortawesome/fontawesome-free",
    from: "LICENSE.txt",
    to: resolve(faPath.fontAwesome, "LICENSE.txt"),
  },
  {
    context: "./node_modules/@fortawesome/fontawesome-free/css",
    from: "all.min.css",
    to: resolve(faPath.fontAwesome, "css"),
  },
  {
    context: "./node_modules/@fortawesome/fontawesome-free",
    from: "webfonts",
    to: resolve(faPath.fontAwesome, "webfonts"),
  },
]);

module.exports = {
  mode: "production",
  devtool: "source-map",
  entry: {
    "pydata-sphinx-theme": resolve(scriptPath, "pydata-sphinx-theme.js"),
    "bootstrap": resolve(scriptPath, "bootstrap.js"),
  },
  output: {filename: "scripts/[name].js", path: staticPath},
  optimization: {minimizer: [new TerserPlugin(), new OptimizeCssAssetsPlugin({})]},
  externals: {jquery: "jQuery"}, // will be removed with Sphinx 6
  module: {
    rules: [{
      test: /\.scss$/,
      use: [
        {loader: "file-loader", options: {name: "styles/[name].css"}},
        {loader: "extract-loader"},
        {loader: "css-loader?-url"}, //url()-inlining turned off}
        {loader: "sass-loader",},
      ],
    }],
  },
  plugins: [htmlWebpackPlugin, copyPlugin],
};
