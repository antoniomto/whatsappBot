const procesarMensaje = require('../utils');

describe('Procesar mensajes correctamente', () => {
    test('Mensaje mas comun', () => {
        const input = "Mk cross $1100";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Mk cross precio: $1240"
        });
    });

    test('Solo con precio', () => {
        const input = "$1100";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "$1240"
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
        const input = "Playera raplh $1100 anticipo $200";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Playera raplh precio: $1240"
        });
    });

    test('Procesa mensaje con talla', () => {
        const input = "Cinto talla s/m perfecto para usar con vestido $530";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Cinto talla s/m perfecto para usar con vestido precio: $610"
        });
    });

    test('Mucha descripcion', () => {
        const input = "Hay es otro modelo de Pandora es un poco mas elevado el precio pero si. Hay tallas si costo es de $1100 anticpo $700";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Hay es otro modelo de Pandora es un poco mas elevado el precio pero si. Hay tallas si  es de precio: $1240"
        });
    });

    test('Caracteres con acentos', () => {
        const input = "Hay es otro modelo más de Pandora $1100";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Hay es otro modelo más de Pandora precio: $1240"
        });
    });
   
    //Stanley $980 y ya con accesorios aumenta el precio dependiendo de que quisieran que se le agregara
    test('precio intermedio', () => {
        const input = "Stanley $1100 y ya con accesorios aumenta el precio dependiendo de que quisieran que se le agregara";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Stanley precio: $1240"
        });
    });

    test('dos productos', () => {
        const input = "Sudadera $1100 short 350";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Sudadera precio: $1240; short precio: $400"
        });
    });

    test('dos productos con apartado', () => {
        const input = "Sudadera $1100 apartado 200 short 1150 apartado 100";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Sudadera precio: $1240; short precio: $1300"
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

    test('precio menos 1000', () => {
        const input = "999";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "$1150"
        });
    });

    test('precio mas 1000 y menos 2000', () => {
        const input = "1999";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "$2260"
        });
    });

    test('precio mas 2000 menos 5000', () => {
        const input = "2999";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "$3300"
        });
    });

    test('precio mas 5000', () => {
        const input = "6000";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "$6480"
        });
    });

    test('precio y anticpo new test', () => {
        const input = "Este modelo esta increible su costo $2890 anticpo $1000 sujeto a disponbibilidad";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Este modelo esta increible su precio: $3180"
        });
    });

    test('precio y anticpo new test', () => {
        const input = "Este modelo esta increible su costo 2,890 anticpo $1000 sujeto a disponbibilidad";
        const output = procesarMensaje(input);
        expect(output).toEqual({
            isValid: true,
            text: "Este modelo esta increible su precio: $3180"
        });
    });
});