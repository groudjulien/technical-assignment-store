import { isPermission, JSONArray, JSONObject, JSONPrimitive, Permission } from "./json-types";
import { readFromObject, writeFromObject, allowedOnPath, transformEntriesToGenerateStore, ACTION_ENUM } from "./utils";
import 'reflect-metadata';

export type StoreResult = Store | JSONPrimitive | undefined;

export type StoreValue =
  | JSONObject
  | JSONArray
  | StoreResult
  | (() => StoreResult);

export interface IStore {
  defaultPolicy: Permission;
  allowedToRead(key: string): boolean;
  allowedToWrite(key: string): boolean;
  read(path: string): StoreResult;
  write(path: string, value: StoreValue): StoreValue;
  writeEntries(entries: JSONObject): void;
  entries(): JSONObject;
}

export function Restrict(...params: unknown[]): any {
  const permission = params && params.length > 0 && isPermission(params[0]) ? params[0] : null;
  return function (target: any, key: string) {
    Reflect.defineMetadata("permission", permission, target, key);
  }
}

export class Store implements IStore {
  @Restrict("none")
  defaultPolicy: Permission = "rw";

  allowedToRead(key: string): boolean {
    return allowedOnPath(ACTION_ENUM.read, this, key, this.defaultPolicy);
  }

  allowedToWrite(key: string): boolean {
    return allowedOnPath(ACTION_ENUM.write, this, key, this.defaultPolicy);
  }

  read(path: string): StoreResult {
    if ( !this.allowedToRead(path) ) {
      throw new Error("Access Forbidden");
    }
    return readFromObject(this, path);
  }

  write(path: string, value: StoreValue): StoreValue {
    if ( !this.allowedToWrite(path) ) {
      throw new Error("Access Forbidden");
    }
    return writeFromObject(this, path, transformEntriesToGenerateStore(value));
  }

  writeEntries(entries: JSONObject): void {
    for ( const key in entries ) {
      this.write(key, entries[key]);
    }
  }

  entries(): JSONObject {
    const entries: JSONObject = {};
    for ( const key of Object.keys(this) ) {
      if ( this.allowedToRead(key) ) {
        const value = this.read(key);
        if ( value instanceof Store ) {
          entries[key] = value.entries();
        } else if ( value !== null && value !== undefined ) {
          entries[key] = value;
        }
      }
    }
    return entries;
  }
}
