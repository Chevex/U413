var repl = require('repl'),
    stream = require('stream');

// Store repl instances in process as it is ok if they get blown away now and then.
process.repls = {};

exports.roles = 'admin';

exports.description = "Starts a node.js REPL.";

exports.usage = "[options]";

exports.options = {
    data: {
        hidden: true
    }
};

exports.invoke = function (shell, options) {
    var socket = shell.getVar('socket'),
        hasRepl = process.repls.hasOwnProperty(socket.id);

    // If the user does not have a repl instance stored in process or they are starting the repl with --clean then
    // create a new repl instance.
    if (!hasRepl || !options.hasOwnProperty('data')) {
        // Create pass-through streams in order to manually communicate with the repl instance.
        var inputStream = new stream.PassThrough(),
            outputStream = new stream.PassThrough();

        // When the output stream receives data, pump that data through the shotgun shell instance.
        outputStream.on('data', function (data) {
            if (data !== null) {
                data.toString().split('\n').forEach(function (line) {
                    if (!/^\s*$/.test(line))
                        shell.debug(line.replace(/\n/g, ''), { dontType: true });
                });
            }
        });

        // Start the repl and get reference to the repl instance.
        var replInstance = repl.start({
            prompt: '',
            ignoreUndefined: true,
            input: inputStream,
            output: outputStream
        });

        // Override clear command so it also clears the shell display.
        var clearCmd = replInstance.commands['.clear'],
            exitCmd = replInstance.commands['.exit'],
            oldClearAction = clearCmd.action,
            oldExitAction = exitCmd.action;
        clearCmd.action = function () {
            shell.clearDisplay();
            oldClearAction.call(this);
            replInstance.context.shell = shell;
        };
        exitCmd.action = function () {
            shell.clearPrompt();
            oldExitAction.call(this);
        };

        // Add the shell instance to the repl context.
        replInstance.context.shell = shell;

        process.repls[socket.id] = { input: inputStream, output: outputStream };
        socket.on('disconnect', function () {
            delete process.repls[socket.id];
        });
        shell.setPrompt('data', 'repl', {}, "REPL");
    }
    else if (options.hasOwnProperty('data') && hasRepl) {
        shell.log("> {0}".format(options.data), { dontType: true });
        process.repls[socket.id].input.write(options.data + '\n');
        if (options.data !== '.exit') {
            delete options.data;
            shell.setPrompt('data', 'repl', {}, "REPL");
        }
    }
};