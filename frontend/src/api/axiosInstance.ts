import axios from "axios";
import type { AxiosResponse } from "axios";
import { camelCase, isObject, isArray } from "lodash";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

const axiosInstance = axios.create();

// Updated utility for converting to camelCase
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

// Export the error type checker
const isAxiosError = axios.isAxiosError;

// Interceptor to transform responses to camelCase
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = convertKeysToCamelCase(response.data);
    }
    //console.log('Response Data: ', response.data);
    return response;
  },
  (error) => Promise.reject(error)
);

export { axiosInstance, isAxiosError };
