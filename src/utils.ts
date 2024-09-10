import { isJSONObject, Permission } from "./json-types";
import { Store, StoreResult, StoreValue } from "./store";

export enum ACTION_ENUM {
    read = 'read',
    write = 'write'
}

const KEY_CONST_FOR_STORE = "store";
const READ_ROLES = ["r", 'rw'];
const WRITE_ROLES = ["w", 'rw'];

export const assertIsStoreValue = (value: StoreValue): StoreValue => {
    if (value instanceof Store || ["number", "string", "object", "boolean", "function", "undefined"].includes(typeof value)) {
        return value;
    }
    throw new Error('Value is not of type StoreValue');
}

export function haveRole(roles: string | undefined, action: ACTION_ENUM): boolean {
    if (
        (action === ACTION_ENUM.read && !READ_ROLES.includes(roles ?? "none"))
        || (action === ACTION_ENUM.write && !WRITE_ROLES.includes(roles ?? "none"))
    ) {
      return false;
    };
    return true;
}

export function transformEntriesToGenerateStore(entries: StoreValue): StoreValue {
    if ( isJSONObject(entries) ) {
        const result: StoreValue = {}
        for ( const key in entries ) {
            if ( key === KEY_CONST_FOR_STORE ) {
                const store = new Store();
                if ( isJSONObject(entries[key]) ) {
                    store.writeEntries(entries[key]);
                }
                // @ts-ignore
                result[key] = store;
            } else {
                // @ts-ignore
                result[key] = transformEntriesToGenerateStore(entries[key]);
            }
        }
        return result;
    } else {
        return entries;
    }
    
}

function getNextKeyAndPath(path: string): { key: string, nextPath: string, isLastPath: boolean } {
    const pathSplitted = path.split(":");
    const key = pathSplitted[0];
    const nextPath = pathSplitted.slice(1).join(":");
    return { key, nextPath, isLastPath: pathSplitted.length === 1 };
}

export function allowedOnPath(action: ACTION_ENUM, obj: StoreValue, path: string, defaultPolicy: Permission): boolean {
    const { key, nextPath, isLastPath } = getNextKeyAndPath(path);
    if ( obj && Object.keys(obj).includes(key) ) {
      const value = assertIsStoreValue(obj[key as keyof typeof obj]);
      const newDefaultPolicy = obj instanceof Store ? obj.defaultPolicy : defaultPolicy;
      const permission = Reflect.getMetadata("permission", obj, key) ?? newDefaultPolicy;
      if ( isLastPath ) {
        return haveRole(permission, action);
      } else {
        if (value instanceof Store) {
            return value.allowedToRead(nextPath)
        } else if (typeof value === "function") {
            return allowedOnPath(action, value(), nextPath, newDefaultPolicy);
        } else {
            return allowedOnPath(action, value, nextPath, newDefaultPolicy)
        }
      }
    } else {
        if(!obj) { obj = {}}
        if ( haveRole(defaultPolicy, action) ) {
            (obj as any)[key] = "test";
            const result = allowedOnPath(action, obj, key, defaultPolicy)
            delete (obj as any)[key];
            return result;
        } else {
            return false;
        }
    }
}

export function readFromObject(obj: StoreValue, path: string): StoreResult {
    const { key, nextPath, isLastPath } = getNextKeyAndPath(path);
    if ( obj && Object.keys(obj).includes(key) ) {
      const value = assertIsStoreValue(obj[key as keyof typeof obj]);
      if ( isLastPath ) {
        if (typeof value === "function") {
            return value();
        } else if (!(value instanceof Store) && typeof value === "object" && value !== null && value !== undefined) {
            return JSON.stringify( value );
        } else {
          return value
        }
      } else {
        if (value instanceof Store) {
            return value.read(nextPath);
        } else if (typeof value === "function") {
            return readFromObject(value(), nextPath);
        } else {
            return readFromObject(value, nextPath);
        }
      }
    } else {
        return undefined;
    }
}
  
export function writeFromObject(obj: StoreValue, path: string, newValue: StoreValue): StoreValue {
    const { key, nextPath, isLastPath } = getNextKeyAndPath(path);
    if ( obj && Object.keys(obj).includes(key) ) {
      const value = assertIsStoreValue(obj[key as keyof typeof obj] as StoreValue);
      if ( isLastPath ) {
        (obj as any)[key] = newValue;
      } else {
        if (value instanceof Store) {
          return value.write(nextPath, newValue);
        } else {
          return writeFromObject(value, nextPath, newValue);
        }
      }
    } else {
      if (!obj) { obj = {}; }
      if ( isLastPath ) {
        (obj as any)[key] = newValue;
        return newValue;
      } else {
        (obj as any)[key] = {};
        return writeFromObject(obj[key as keyof typeof obj], nextPath, newValue);
      }
    }
}