const express = require("express");
const swaggerUi = require("swagger-ui-express");
const yaml = require("yamljs");
const path = require("path");

const router = express.Router();

const document = yaml.load(path.join(__dirname, "../openapi.yaml"));

router.use("/", swaggerUi.serve);
router.get("/", swaggerUi.setup(document));

module.exports = router;
