import { Navigation, Script } from "scripting";
import { createController } from "./runtime";
import { App } from "./ui/app";

async function run() {
  const controller = createController();
  try { await Navigation.present({ element: <App controller={controller} /> }); }
  catch (error) { console.error("战地战绩查询界面无法启动", error); }
  finally { controller.dispose(); Script.exit(); }
}
void run();
