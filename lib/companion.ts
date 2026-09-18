export const COMPANION_HOME = "/companion";
export const COMPANION_LOGIN = "/companion/login";
export const COMPANION_NAME = "Venturo Companion App";

export function companionEventHref(id: string) {
  return `${COMPANION_HOME}/events/${id}`;
}

export function isCompanionPath(path: string) {
  return path === COMPANION_HOME || path.startsWith(`${COMPANION_HOME}/`);
}

export function companionLoginHref() {
  return COMPANION_LOGIN;
}
