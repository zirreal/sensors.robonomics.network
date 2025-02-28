import config from "@config";

export function setTypeProvider(type) {
  localStorage.setItem("provider_type", type);
}

export function getTypeProvider() {
  return localStorage.getItem("provider_type") || config.DEFAUL_TYPE_PROVIDER;
}

export function mergeDeep(target, source) {
  const isObject = (obj) => obj && typeof obj === "object";

  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  Object.keys(source).forEach((key) => {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      // target[key] = targetValue.concat(sourceValue);
      target[key] = sourceValue;
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
    } else {
      target[key] = sourceValue;
    }
  });

  return target;
}
