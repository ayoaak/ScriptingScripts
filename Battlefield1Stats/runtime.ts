import { createApi } from "./core/api";
import { PlayerController } from "./core/controller";
import { STORAGE_KEY } from "./core/store";

// fetch and Storage are globals supplied by Scripting, not browser localStorage.
export function createController() {
  return new PlayerController(createApi((url, options) => fetch(url, options)), {
    get: () => Storage.get<unknown>(STORAGE_KEY),
    set: value => Storage.set(STORAGE_KEY, value),
  });
}
