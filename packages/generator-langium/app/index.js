var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var yo = require("yeoman-generator");
var SimpleGenerator = (function (_super) {
    __extends(SimpleGenerator, _super);
    function SimpleGenerator(args, options) {
        _super.call(this, args, options);
        this.log("Constructor");
    }
    SimpleGenerator.prototype.initialize = function () {
        this.log("initialize() : Your initialization methods (checking current project state, getting configs, etc)");
    };
    SimpleGenerator.prototype.prompting = function () {
        this.log("prompting() : Where you prompt users for options (where you'd call this.prompt())");
    };
    SimpleGenerator.prototype.configuring = function () {
        this.log("configuring() : Saving configurations and configure the project (creating .editorconfig files and other metadata files)");
    };
    SimpleGenerator.prototype.writing = function () {
        this.log("writing() : Where you write the generator specific files (routes, controllers, etc)");
    };
    SimpleGenerator.prototype.install = function () {
        this.log("install() : Where installation are run (npm, bower)");
    };
    SimpleGenerator.prototype.end = function () {
        this.log("end() : Called last, cleanup, say good bye, etc");
    };
    SimpleGenerator.prototype.SomeMethod = function () {
        this.log("SomeMethod");
    };
    SimpleGenerator.prototype.AnotherMethod = function () {
        this.log("AnotherMethod");
    };
    return SimpleGenerator;
})(yo.generators.Base);
module.exports = SimpleGenerator;
//# sourceMappingURL=index.js.map