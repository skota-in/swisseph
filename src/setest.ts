import { initialize_test_context, evaluate_cmdline_options, run, cleanup, print_help, get_param_reader, get_disabled } from './setest_helpers';
import { open_reader, open_reader_from_stream, read_next_block, read_value, read_value_in_section, close_reader } from './reader_helpers';
import { multivalues_create_table, multivalues_clear, multivalues_all_done, multivalues_destroy_table } from './multivalues_helpers';
import { swe_version } from 'swisseph';
import { SHA1 } from 'crypto';
import { ALL, DEFAULT_PRECISION, SECTION_KEYWORDS, PARAMETER_SECTIONS, DEFAULT_TEST_COLLECTION, PREPARE_FIXTURE_COMMAND, HELPFILE } from './constants';

interface TestContext {
  testmode: boolean;
  selected: {
    testsuite: number;
    testcase: number;
    iteration: number;
  };
  current: {
    suite: {
      id: number;
      descr: string;
      disabled: boolean;
    };
    testcase: {
      id: number;
      descr: string;
      disabled: boolean;
    };
    iteration: {
      id: number;
      failures: any[];
    };
    section: string;
    file: string;
  };
  precisions: {
    all: number;
    xx: number[];
  };
  multivalues: any;
  reader: any;
  parameters: any;
  out: any;
  verbose: boolean;
  count: {
    testsuite: number;
    testcase: number;
    iteration: number;
    failures: number;
    failed_iterations: number;
  };
  test_collection: string;
  prepare_fixture_command: string;
}

interface SHA1HASH {
  key: number[];
}

function main(argc: number, argv: string[]): number {
  const ctx: TestContext = {} as TestContext;
  initialize_test_context(ctx);
  evaluate_cmdline_options(argc, argv, ctx);
  run(ctx);
  const exit_code = ctx.count.failures > 0 ? 1 : 0;
  cleanup(ctx);
  return exit_code;
}

function run(ctx: TestContext): void {
  function general_setup(): void {
    check_file_existence();
    open_exp_or_fix_reader();
    open_output_stream();
    if (!ctx.testmode) print_header_data(ctx);
  }

  function general_cleanup(): void {
    close_reader(ctx.reader);
    close_reader(ctx.parameters);
    if (ctx.out && ctx.out !== process.stdout) ctx.out.close();
  }

  function open_exp_or_fix_reader(): void {
    const file = `${ctx.test_collection}${ctx.testmode ? '.exp' : '.fix'}`;
    if (isEmpty(ctx.prepare_fixture_command)) {
      ctx.prepare_fixture_command = `${PREPARE_FIXTURE_COMMAND} ${file}`;
    }
    ctx.reader = open_reader(file, ctx.testmode ? null : ctx.prepare_fixture_command, SECTION_KEYWORDS);
  }

  function open_output_stream(): void {
    if (!ctx.testmode) {
      const file = `${ctx.test_collection}.exp`;
      ctx.out = fs.createWriteStream(file, { flags: 'w' });
      ctx.out.on('error', (err: Error) => {
        console.error(`Can't open file '${file}' for output... using stdout`);
        ctx.out = process.stdout;
      });
    } else {
      ctx.out = process.stdout;
    }
  }

  function print_stats(): void {
    console.log(`${ctx.testmode ? 'Testmode' : 'gen-mode'} '${ctx.test_collection}': Total ${ctx.count.testsuite}/${ctx.count.testcase}/${ctx.count.iteration}`);
    if (ctx.testmode) {
      console.log(`... ${ctx.count.failures} failures in ${ctx.count.failed_iterations} iterations`);
    }
    console.log('.');
  }

  function check_file_existence(): void {
    const file = `${ctx.test_collection}.fix`;
    if (ctx.testmode) {
      const expFile = `${ctx.test_collection}.exp`;
      if (!fs.existsSync(expFile)) {
        console.error(`Cannot read expectations '${expFile}'.\nGenerate it with 'setest -g ${ctx.test_collection}\n`);
        process.exit(1);
      }
    } else {
      if (!fs.existsSync(file)) {
        console.error(`There is no fixture file '${file}'.\nYou may generate it with 'make ${file}'.\n`);
        process.exit(1);
      }
    }
  }

  general_setup();
  read_next_block(ctx.reader, 'GENERAL');
  if (ctx.parameters.source) read_next_block(ctx.parameters, 'GENERAL');
  run_tests(ctx);
  print_stats();
  general_cleanup();
}

function initialize_test_context(ctx: TestContext): void {
  Object.assign(ctx, {
    testmode: true,
    selected: {
      testsuite: ALL,
      testcase: ALL,
      iteration: ALL,
    },
    current: {},
    precisions: { all: DEFAULT_PRECISION, xx: Array(6).fill(DEFAULT_PRECISION) },
    multivalues: multivalues_create_table(),
    reader: { source: null },
    parameters: { source: null },
    test_collection: DEFAULT_TEST_COLLECTION,
    prepare_fixture_command: '',
    verbose: false,
    count: {
      testsuite: 0,
      testcase: 0,
      iteration: 0,
      failures: 0,
      failed_iterations: 0,
    },
  });
}

function evaluate_cmdline_options(argc: number, argv: string[], ctx: TestContext): void {
  const options = {
    gen: false,
    verbose: false,
    select: '',
    preprocess: '',
    parameters: '',
    help: false,
  };

  const long_options = [
    { name: 'gen', has_arg: false, flag: 'gen' },
    { name: 'verbose', has_arg: false, flag: 'verbose' },
    { name: 'select', has_arg: true, flag: 'select' },
    { name: 'preprocess', has_arg: true, flag: 'preprocess' },
    { name: 'parameters', has_arg: true, flag: 'parameters' },
    { name: 'help', has_arg: false, flag: 'help' },
  ];

  const parse_select = (optarg: string, selected: { testsuite: number; testcase: number; iteration: number }): void => {
    const n = sscanf(optarg, '%d.%d.%d', selected.testsuite, selected.testcase, selected.iteration);
    if (n === 0) {
      console.log(`Don't understand argument '${optarg}' - ignored.`);
    }
  };

  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const option = long_options.find((opt) => `--${opt.name}` === arg);
      if (option) {
        if (option.has_arg) {
          options[option.flag] = args[++i];
        } else {
          options[option.flag] = true;
        }
      }
    } else if (arg.startsWith('-')) {
      const short_option = arg.slice(1);
      if (short_option === 'g') {
        options.gen = true;
      } else if (short_option === 'v') {
        options.verbose = true;
      } else if (short_option === 's') {
        options.select = args[++i];
      } else if (short_option === 'P') {
        options.preprocess = args[++i];
      } else if (short_option === 'p') {
        options.parameters = args[++i];
      } else if (short_option === '?') {
        options.help = true;
      }
    } else {
      if (!ctx.test_collection) {
        ctx.test_collection = arg;
        if (endsWith(ctx.test_collection, '.fix') || endsWith(ctx.test_collection, '.exp')) {
          ctx.test_collection = ctx.test_collection.slice(0, -4);
        }
      } else {
        console.log(`Argument '${arg}' ignored.`);
      }
    }
  }

  if (options.gen) {
    ctx.testmode = false;
  }
  if (options.parameters) {
    ctx.parameters = get_param_reader(options.parameters);
  }
  if (options.preprocess) {
    ctx.prepare_fixture_command = options.preprocess;
  }
  if (options.select) {
    parse_select(options.select, ctx.selected);
  }
  if (options.verbose) {
    ctx.verbose = true;
  }
  if (options.help) {
    print_help();
    process.exit(0);
  }
}

function open_testsuite(id: number, description: string, ctx: TestContext): void {
  ctx.current.suite.id = id;
  ctx.current.suite.descr = description;
  ctx.current.section = 'TESTSUITE';
  if (ctx.verbose) {
    console.log(`Opening test suite \n  ${id}: ${description}\n  located in ${ctx.current.file}`);
  }
  if (!read_next_section(ctx.reader, id, 'TESTSUITE')) {
    console.error(`Could not read next testsuite section (${id})`);
    process.exit(1);
  }
  const disabled = get_disabled('TESTSUITE', ctx);
  ctx.current.suite.disabled = disabled > 0;
  if (!ctx.testmode) {
    ctx.out.write(`TESTSUITE\n`);
    ctx.out.write(`  section-id: ${id}\n`);
    ctx.out.write(`  section-descr: ${description}\n`);
    if (disabled) {
      ctx.out.write(`  disabled: ${disabled}\n`);
    }
  }
}

function prepare_precisions(ctx: TestContext): void {
  let prec_all: string | null = null;
  if (ctx.parameters.source) {
    prec_all = read_value(ctx.parameters, 'precision', 'GENERAL', 'GENERAL');
  }
  if (!prec_all) {
    prec_all = read_value(ctx.reader, 'precision', 'TESTCASE', 'GENERAL');
  }
  if (prec_all) {
    if (!sscanf(prec_all, '%lf', ctx.precisions.all)) {
      console.error(`Can't read double from precision value '${prec_all}'`);
      process.exit(1);
    }
    ctx.precisions.xx.fill(ctx.precisions.all);
    if (!ctx.testmode) {
      ctx.out.write(`    precision: ${prec_all}\n`);
    }
    if (ctx.verbose) {
      console.log(`    precision: ${prec_all}`);
    }
  }
  let prec_xx: string | null = null;
  if (ctx.parameters.source) {
    prec_xx = read_value(ctx.parameters, 'precision-xx', 'GENERAL', 'GENERAL');
  }
  if (!prec_xx) {
    prec_xx = read_value(ctx.reader, 'precision-xx', 'TESTCASE', 'GENERAL');
  }
  if (prec_xx) {
    if (sscanf(prec_xx, ' %lf , %lf , %lf , %lf , %lf , %lf ', ...ctx.precisions.xx) !== 6) {
      console.error(`Couldn't read 6 values for precision-xx in '${prec_xx}'`);
      process.exit(1);
    }
    if (!ctx.testmode) {
      ctx.out.write(`    precision-xx: ${prec_xx}\n`);
    }
    if (ctx.verbose) {
      console.log(`    precision-xx: ${prec_xx}`);
    }
  }
}

function close_testsuite(ctx: TestContext): void {
  if (!ctx.testmode || !ctx.current.suite.disabled) {
    ctx.count.testsuite++;
  }
}

function open_testcase(id: number, description: string, ctx: TestContext): void {
  ctx.current.testcase.id = id;
  ctx.current.testcase.descr = description;
  ctx.current.section = 'TESTCASE';
  if (ctx.verbose) {
    console.log(`  Opening test case \n    ${id}: ${description}`);
  }
  if (!read_next_section(ctx.reader, id, 'TESTCASE')) {
    console.error(`Could not read next testcase section (${id})`);
    process.exit(1);
  }
  const disabled = get_disabled('TESTCASE', ctx);
  ctx.current.testcase.disabled = disabled > 0;
  if (!ctx.testmode) {
    ctx.out.write(`  TESTCASE\n`);
    ctx.out.write(`    section-id: ${id}\n`);
    ctx.out.write(`    section-descr: ${description}\n`);
    if (disabled) {
      ctx.out.write(`    disabled: ${disabled}\n`);
    }
  }
  prepare_precisions(ctx);
}

function close_testcase(ctx: TestContext): void {
  multivalues_clear(ctx.multivalues);
  ctx.count.testcase++;
}

function open_iteration(id: number, ctx: TestContext): void {
  ctx.current.section = 'ITERATION';
  const enabled = is_iteration_selected(ctx);
  if (ctx.verbose && enabled) {
    console.log(`      Iteration ${id}`);
  }
  if (multivalues_all_done(ctx.multivalues)) {
    multivalues_clear(ctx.multivalues);
    read_next_section(ctx.reader, id, 'ITERATION');
  }
  if (!ctx.testmode && enabled) {
    ctx.out.write(`    ITERATION\n`);
    ctx.out.write(`      section-id: ${ctx.current.iteration.id}  #${ctx.current.suite.id}.${ctx.current.testcase.id}.${ctx.current.iteration.id}\n`);
    const section_descr = read_value(ctx.reader, 'section-descr', 'ITERATION', 'ITERATION');
    if (section_descr) {
      ctx.out.write(`      section-descr: ${section_descr}\n`);
    }
  }
}

function read_next_section(reader: any, id: number, section: string): boolean {
  let section_id: string | null;
  do {
    if (reader.next_section === 'END_OF_FILE') {
      return false;
    }
    read_next_block(reader, section);
    if (id === 0) return true;
    section_id = read_value_in_section(reader, 'section-id', section);
    if (!section_id) return true;
    if (parseInt(section_id) === id) return true;
    if (reader.next_section < section) return false;
  } while (true);
  return false;
}

function close_iteration(ctx: TestContext): void {
  handle_failures(ctx);
  clear_failures(ctx.current.iteration.failures);
  ctx.count.iteration++;
}

function is_iteration_selected(ctx: TestContext): boolean {
  return (ctx.selected.iteration === ALL || ctx.selected.iteration === ctx.current.iteration.id) && is_test_enabled(ctx);
}

function is_testcase_selected(id: number, ctx: TestContext): boolean {
  return ctx.selected.testcase === ALL || ctx.selected.testcase === id;
}

function is_test_enabled(ctx: TestContext): boolean {
  return !ctx.current.suite.disabled && !ctx.current.testcase.disabled;
}

function is_suite_selected(id: number, ctx: TestContext): boolean {
  return ctx.selected.testsuite === ALL || ctx.selected.testsuite === id;
}

function has_more_iterations(ctx: TestContext): boolean {
  return !multivalues_all_done(ctx.multivalues) || ctx.reader.next_section === 'ITERATION';
}

function print_header_data(ctx: TestContext): void {
  print_date_time_user(ctx);
  print_version(ctx);
  print_library_info(ctx);
}

function print_date_time_user(ctx: TestContext): void {
  const t = new Date();
  const localtime = `${t.getDate()}.${t.getMonth() + 1}.${t.getFullYear()} ${t.getHours()}:${t.getMinutes()}:${t.getSeconds()}`;
  ctx.out.write(`localtime: ${localtime}\n`);

  const user = os.userInfo().username;
  ctx.out.write(`user: ${user}\n`);
}

function print_version(ctx: TestContext): void {
  const version = swe_version();
  ctx.out.write(`swisseph-version: ${version}\n`);
}

function print_library_info(ctx: TestContext): void {
  const dl_info = process.dlopen(swe_version);
  ctx.out.write(`shared-lib-fname: ${dl_info.filename}\n`);

  const hash = sha1_from_file(dl_info.filename);
  ctx.out.write(`shared-lib-sha1: ${hash}\n`);
}

function sha1_from_file(name: string): string {
  const buffer = fs.readFileSync(name);
  const hash = SHA1(buffer);
  return hash.toString('hex').toUpperCase();
}

function cleanup(ctx: TestContext): void {
  multivalues_destroy_table(ctx.multivalues);
}

function print_help(): void {
  const help = fs.readFileSync(HELPFILE, 'utf8');
  console.log(help);
}

function get_param_reader(arg: string): any {
  if (arg.includes(':')) {
    const a = arg.replace(/;/g, '\n');
    const f = Buffer.from(`${a}\n`);
    return open_reader_from_stream(f, PARAMETER_SECTIONS);
  } else {
    return open_reader(arg, null, PARAMETER_SECTIONS);
  }
}

function get_disabled(section: string, ctx: TestContext): number {
  const disabled_value = read_value_in_section(ctx.reader, 'disabled', section);
  if (disabled_value === null) return 0;
  const disabled = parseInt(disabled_value);
  if (disabled === 1) {
    switch (section) {
      case 'TESTSUITE':
        console.error(`Suite ${ctx.current.suite.id} (${ctx.current.suite.descr}) disabled`);
        break;
      case 'TESTCASE':
        console.error(`Test case ${ctx.current.suite.id}.${ctx.current.testcase.id} (${ctx.current.testcase.descr}) disabled`);
        break;
      default:
        break;
    }
  }
  return disabled;
}
