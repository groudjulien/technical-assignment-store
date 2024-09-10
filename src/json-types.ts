export type JSONPrimitive = string | number | boolean | null;

export type JSONValue = JSONPrimitive | JSONArray | JSONObject;

export interface JSONObject {
  [key: string]: JSONValue;
}

export function isJSONObject(value: any): value is JSONObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type JSONArray = JSONValue[];


export type Permission = "r" | "w" | "rw" | "none";

export function isPermission(value: any): value is Permission {
  return typeof value === "string" && ["r", "w", "rw", "none"].includes(value);
}
