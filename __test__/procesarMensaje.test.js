const procesarMensaje = require('../utils');

describe('Procesar mensajes correctamente', () => {
    test('Mensaje mas comun', () => {
        const input = "Mk cross $1000";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Mk cross, precio: $1130"
        });
    });

    test('Solo con precio', () => {
        const input = "$1000";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "$1130"
        });
    });

    test('Mensaje sin precio', () => {
        const input = "Tambien hay en 32";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: false,
            text: "Tambien hay en 32"
        });
    });

    test('Procesa mensaje con apartado y contado', () => {
        const input = "Polo mediana contado $490 apartado $550";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: false,
            text: "Polo mediana contado $490 apartado $550"
        });
    });

    test('Procesa mensaje con anticipo', () => {
        const input = "Playera raplh $1000 anticipo $200";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Playera raplh, precio: $1130"
        });
    });

    test('Procesa mensaje con talla', () => {
        const input = "Cinto talla s/m perfecto para usar con vestido $530";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Cinto talla s/m perfecto para usar con vestido, precio: $600"
        });
    });

    test('Mucha descripcion', () => {
        const input = "Hay es otro modelo de Pandora es un poco mas elevado el precio pero si. Hay tallas si costo es de $2690 anticpo $700";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Hay es otro modelo de Pandora es un poco mas elevado el precio pero si. Hay tallas si costo es de, precio: $3040"
        });
    });

    test('Caracteres con acentos', () => {
        const input = "Hay es otro modelo más de Pandora $2690";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Hay es otro modelo más de Pandora, precio: $3040"
        });
    });
   
    //Stanley $980 y ya con accesorios aumenta el precio dependiendo de que quisieran que se le agregara
    test('precio intermedio', () => {
        const input = "Stanley $980 y ya con accesorios aumenta el precio dependiendo de que quisieran que se le agregara";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Stanley, precio: $1110"
        });
    });

    test('dos productos', () => {
        const input = "Sudadera $1000 short 350";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Sudadera, precio: $1130; short, precio: $400"
        });
    });

    test('dos productos con apartado', () => {
        const input = "Sudadera $1000 apartado 200 short 350 apartado 100";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Sudadera, precio: $1130; short, precio: $400"
        });
    });

    test('tres productos con precio contado o apartado, enviar a revision', () => {
        const input = "Sudadera contado $1000 apartado $1200 short contado 350 apartado 450";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: false,
            text: "Sudadera contado $1000 apartado $1200 short contado 350 apartado 450"
        });
    });
});