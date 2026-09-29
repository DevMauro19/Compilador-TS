rl.on("line", (line: string) => {
  const lexer = new Lexer(line);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();

  if (parser.errors.length > 0) {
    console.log("Errores de parseo:");
    parser.errors.forEach((e) => console.log("\t" + e));
  } else {
    console.log(program.toString());
  }

  rl.prompt();
});
