// evaluator/builtins.ts
// Funciones integradas de ChoomScript. El evaluador las busca aquí cuando un
// identificador no está declarado en ningún ámbito del programa.
// La cantidad de argumentos (arity) la valida applyFunction antes de llamarlas.
import {
  ArrayObj,
  BuiltinObj,
  Bool,
  ErrorObj,
  HashObj,
  Integer,
  LangObject,
  NULL,
  StringObj,
} from "../object/object.ts";

// holo(a, b, ...): proyecta los valores en pantalla separados por espacio.
const holo = new BuiltinObj("holo", null, (args) => {
  console.log(args.map((arg) => arg.inspect()).join(" "));
  return NULL;
});

// len(x): cantidad de elementos de un arreglo, pares de un hash o caracteres de una cadena.
const len = new BuiltinObj("len", 1, ([arg]) => {
  if (arg instanceof ArrayObj) return new Integer(arg.elements.length);
  if (arg instanceof HashObj) return new Integer(arg.pairs.size);
  if (arg instanceof StringObj) return new Integer(arg.value.length);
  return new ErrorObj(`len() no admite ${arg.type()}`);
});

// first, last, rest y push trabajan sobre arreglos y nunca modifican el original.
const first = new BuiltinObj("first", 1, ([arg]) => {
  if (!(arg instanceof ArrayObj)) return new ErrorObj(`first() requiere un arreglo, recibió ${arg.type()}`);
  return arg.elements[0] ?? NULL;
});

const last = new BuiltinObj("last", 1, ([arg]) => {
  if (!(arg instanceof ArrayObj)) return new ErrorObj(`last() requiere un arreglo, recibió ${arg.type()}`);
  return arg.elements[arg.elements.length - 1] ?? NULL;
});

// rest(arr): todos los elementos menos el primero.
const rest = new BuiltinObj("rest", 1, ([arg]) => {
  if (!(arg instanceof ArrayObj)) return new ErrorObj(`rest() requiere un arreglo, recibió ${arg.type()}`);
  return new ArrayObj(arg.elements.slice(1));
});

// push(arr, x): un arreglo NUEVO con x al final.
const push = new BuiltinObj("push", 2, ([arr, value]) => {
  if (!(arr instanceof ArrayObj)) return new ErrorObj(`push() requiere un arreglo, recibió ${arr.type()}`);
  return new ArrayObj([...arr.elements, value]);
});

// str(x): convierte cualquier valor a cadena.
const str = new BuiltinObj("str", 1, ([arg]) => new StringObj(arg.inspect()));

// int(x): convierte una cadena numérica o un booleano a entero.
const int = new BuiltinObj("int", 1, ([arg]) => {
  if (arg instanceof Integer) return arg;
  if (arg instanceof Bool) return new Integer(arg.value ? 1 : 0);
  if (arg instanceof StringObj && /^\s*-?\d+\s*$/.test(arg.value)) {
    const value = Number(arg.value);
    if (Number.isSafeInteger(value)) return new Integer(value);
  }
  return new ErrorObj(`int() no puede convertir ${describe(arg)} a entero`);
});

// type(x): nombre del tipo del valor ("INTEGER", "STRING", "ARRAY"...).
const type = new BuiltinObj("type", 1, ([arg]) => new StringObj(arg.type()));

function describe(arg: LangObject): string {
  return arg instanceof StringObj ? `"${arg.value}"` : arg.type();
}

export const builtins = new Map<string, BuiltinObj>(
  [holo, len, first, last, rest, push, str, int, type].map((b) => [b.name, b])
);
