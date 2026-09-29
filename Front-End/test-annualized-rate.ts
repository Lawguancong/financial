import moment from 'moment';

const testAnnualizedRate = () => {
  const firstDate = '20200101';
  const currentDate = '20250101';
  const firstClose = 1;
  const closePrice = 2;

  const days = moment(currentDate, 'YYYYMMDD').diff(moment(firstDate, 'YYYYMMDD'), 'days');
  console.log('测试用例：');
  console.log('初始日期:', firstDate);
  console.log('当前日期:', currentDate);
  console.log('天数差:', days);
  console.log('初始值:', firstClose);
  console.log('当前值:', closePrice);
  console.log('涨幅倍数:', closePrice / firstClose);
  console.log('');

  let annualizedRate = 0;
  if (days > 0) {
    annualizedRate = parseFloat((Math.pow(closePrice / firstClose, 365 / days) - 1).toFixed(4));
  }
  const annualizedRatePercent = annualizedRate * 100;

  console.log('年化收益率计算：');
  console.log('公式: Math.pow(当前值/初始值, 365/天数) - 1');
  console.log('计算: Math.pow(' + closePrice + '/' + firstClose + ', 365/' + days + ') - 1');
  console.log('计算: Math.pow(' + (closePrice / firstClose) + ', ' + (365 / days) + ') - 1');
  console.log('计算: ' + Math.pow(closePrice / firstClose, 365 / days) + ' - 1');
  console.log('计算: ' + annualizedRate);
  console.log('年化收益率:', annualizedRatePercent + '%');
  console.log('');

  const years = days / 365;
  console.log('验证：');
  console.log('年数:', years);
  console.log('验证公式: (1 + 年化收益率)^年数');
  console.log('验证计算: (1 + ' + annualizedRate + ')^' + years);
  console.log('验证计算: ' + Math.pow(1 + annualizedRate, years));
  console.log('预期结果: 2');
  console.log('误差:', Math.abs(Math.pow(1 + annualizedRate, years) - 2));

  console.log('');
  console.log('=====================================');
  console.log('');

  const testCases = [
    { firstDate: '20200101', currentDate: '20210101', firstClose: 1, closePrice: 1.1, expectedYears: 1 },
    { firstDate: '20200101', currentDate: '20220101', firstClose: 1, closePrice: 1.21, expectedYears: 2 },
    { firstDate: '20200101', currentDate: '20230101', firstClose: 1, closePrice: 1.331, expectedYears: 3 },
    { firstDate: '20200101', currentDate: '20240101', firstClose: 1, closePrice: 1.4641, expectedYears: 4 },
    { firstDate: '20200101', currentDate: '20250101', firstClose: 1, closePrice: 2, expectedYears: 5 },
  ];

  testCases.forEach((testCase, index) => {
    const testDays = moment(testCase.currentDate, 'YYYYMMDD').diff(moment(testCase.firstDate, 'YYYYMMDD'), 'days');
    const testYears = testDays / 365;
    const testAnnualizedRate = parseFloat((Math.pow(testCase.closePrice / testCase.firstClose, 365 / testDays) - 1).toFixed(4));
    const testAnnualizedRatePercent = testAnnualizedRate * 100;
    const verifyResult = Math.pow(1 + testAnnualizedRate, testYears);

    console.log(`测试用例 ${index + 1}:`);
    console.log('日期范围:', testCase.firstDate, '->', testCase.currentDate);
    console.log('实际天数:', testDays);
    console.log('实际年数:', testYears.toFixed(2));
    console.log('初始值:', testCase.firstClose);
    console.log('当前值:', testCase.closePrice);
    console.log('涨幅倍数:', testCase.closePrice / testCase.firstClose);
    console.log('年化收益率:', testAnnualizedRatePercent.toFixed(2) + '%');
    console.log('验证结果:', verifyResult.toFixed(4));
    console.log('预期结果:', testCase.closePrice);
    console.log('误差:', Math.abs(verifyResult - testCase.closePrice).toFixed(4));
    console.log('');
  });
};

testAnnualizedRate();
