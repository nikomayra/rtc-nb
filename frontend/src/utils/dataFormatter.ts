import { camelCase, snakeCase, isObject, isArray } from "lodash";

// Type Definitions
type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

// Utility to convert keys to camelCase
const convertKeysToCamelCase = (data: JsonValue): JsonValue => {
  if (isArray(data)) {
    return data.map(convertKeysToCamelCase);
  }

  if (isObject(data)) {
    const result: JsonObject = {};
    Object.entries(data as JsonObject).forEach(([key, value]) => {
      result[camelCase(key)] = convertKeysToCamelCase(value);
    });
    return result;
  }

  return data;
};

// Utility to convert keys to snake_case
const convertKeysToSnakeCase = (data: JsonValue): JsonValue => {
  if (isArray(data)) {
    return data.map(convertKeysToSnakeCase);
  }

  if (isObject(data)) {
    const result: JsonObject = {};
    Object.entries(data as JsonObject).forEach(([key, value]) => {
      result[snakeCase(key)] = convertKeysToSnakeCase(value);
    });
    return result;
  }

  return data;
};

export { convertKeysToCamelCase, convertKeysToSnakeCase };
