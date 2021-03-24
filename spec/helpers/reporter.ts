import {SpecReporter, StacktraceOption} from 'jasmine-spec-reporter';

jasmine.getEnv().clearReporters();

jasmine.getEnv().addReporter(
  (new SpecReporter({
    spec: {
      displayStacktrace: StacktraceOption.NONE,
    },
  }) as unknown) as jasmine.CustomReporter
);
