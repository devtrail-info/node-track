// Writes to stdout and stderr, then exits with the code given as the first argument.
process.stdout.write('partial report\n');
process.stderr.write('invoice 7 failed\n');
process.exitCode = Number(process.argv[2] ?? 0);
