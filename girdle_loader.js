var G = require("./girdle.js"),
    isTTY = process.stdout.isTTY;

function beep()
{
    if (isTTY) {
        process.stdout.write("\u0007");
    }
}

function color(color_code, str)
{
    if (isTTY) {
        str = "\u001B[" + color_code + "m" + str + "\u001B[0m";
    }
    
    console.log(str);
}

function note(mixed)
{
    color(36, mixed);
}

function good(mixed)
{
    color(32, mixed);
}

function warn(mixed)
{
    color(33, mixed);
}

function error(mixed)
{
    color(31, mixed);
}

G.beep = beep;
G.color = color;
G.note = note;
G.good = good;
G.warn = warn;
G.error = error;

module.exports = G;
