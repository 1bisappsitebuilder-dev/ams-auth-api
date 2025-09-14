import swaggerJSDoc from "swagger-jsdoc";
import options from "./openApiOptions.json";

export default function () {
	return swaggerJSDoc(options);
}
