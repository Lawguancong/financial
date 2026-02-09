import { Line } from '@ant-design/plots';
import { DualAxes } from '@ant-design/plots';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { createRoot } from 'react-dom/client';
import { format } from 'fecha';
import moment from 'moment';
import { useSetState } from 'ahooks';


const today = moment().format('YYYYMMDD'); // 获取当天日期并格式化为YYYYMMDD


const DemoLine = (props) => {
  const { data = [] } = props;
  const config = {
    data,
    xField: (d) => new Date(d.date),
    yField: 'close',
    axis: {
      x: {
        title: 'x轴标题',
        // padding: 0, // todo 有bug
        size: 40
      },
      y: {
        title: 'y轴标题',
        // padding: 0,
        size: 40
      }
    },
    slider: {
      x: { labelFormatter: (d) => format(d, 'YYYY/M/D') },
      y: { labelFormatter: '~s' },
    },
    tooltip: {
      shared: true, // 提示框共享
      showMarkers: true,
    },
  };
  return <Line {...config} />;
};


const DemoDualAxes = () => {
  const uvBillData = [
    { time: '2019-03', value: 350, type: 'uv' },
    { time: '2019-04', value: 900, type: 'uv' },
    { time: '2019-05', value: 300, type: 'uv' },
    { time: '2019-06', value: 450, type: 'uv' },
    { time: '2019-07', value: 470, type: 'uv' },
    { time: '2019-03', value: 220, type: 'bill' },
    { time: '2019-04', value: 300, type: 'bill' },
    { time: '2019-05', value: 250, type: 'bill' },
    { time: '2019-06', value: 220, type: 'bill' },
    { time: '2019-07', value: 362, type: 'bill' },
  ];

  const transformData = [
    { time: '2019-03', count: 800, name: 'a' },
    { time: '2019-04', count: 600, name: 'a' },
    { time: '2019-05', count: 400, name: 'a' },
    { time: '2019-06', count: 380, name: 'a' },
    { time: '2019-07', count: 220, name: 'a' },
    { time: '2019-03', count: 750, name: 'b' },
    { time: '2019-04', count: 650, name: 'b' },
    { time: '2019-05', count: 450, name: 'b' },
    { time: '2019-06', count: 400, name: 'b' },
    { time: '2019-07', count: 320, name: 'b' },
    { time: '2019-03', count: 900, name: 'c' },
    { time: '2019-04', count: 600, name: 'c' },
    { time: '2019-05', count: 450, name: 'c' },
    { time: '2019-06', count: 300, name: 'c' },
    { time: '2019-07', count: 200, name: 'c' },
  ];

  const config = {
    xField: 'time',
    scale: { color: { range: ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#6F5EF9'] } },
    children: [
      {
        data: uvBillData,
        type: 'line',
        yField: 'value',
        colorField: 'type',
        shapeField: 'smooth',
        style: { lineWidth: 3, lineDash: [5, 5] },
      },
      {
        data: transformData,
        type: 'line',
        yField: 'count',
        colorField: 'name',
        axis: { y: false },
        style: { lineWidth: 3 },
      },
      {
        data: transformData,
        type: 'point',
        yField: 'count',
        colorField: 'name',
        sizeField: 3,
        shapeField: 'point',
        axis: { y: false },
        tooltip: false,
      },
    ],
  };
  return <DualAxes {...config} />;
};



const DemoDualAxes1 = () => {
  const data = [
    { year: '1991', value: 3, count: 10 },
    { year: '1992', value: 4, count: 4 },
    { year: '1993', value: 3.5, count: 5 },
    { year: '1994', value: 5, count: 5 },
    { year: '1995', value: 4.9, count: 4.9 },
    { year: '1996', value: 6, count: 35 },
    { year: '1997', value: 7, count: 7 },
    { year: '1998', value: 9, count: 1 },
    { year: '1999', value: 13, count: 20 },
  ];

  const config = {
    data,
    xField: 'year',
    legend: true,
    children: [
      {
        type: 'line',
        yField: 'value',
        style: {
          stroke: '#5B8FF9',
          lineWidth: 2,
        },
        axis: {
          y: {
            title: 'value',
            style: { titleFill: '#5B8FF9' },
          },
        },
      },
      {
        type: 'line',
        yField: 'count',
        style: {
          stroke: '#5AD8A6',
          lineWidth: 2,
        },
        axis: {
          y: {
            position: 'right',
            title: 'count',
            style: { titleFill: '#5AD8A6' },
          },
        },
      },
    ],
  };
  return <DualAxes {...config} />;
};

const DemoDualAxes2 = (props) => {
  const { data = [] } = props;
  const config = {
    data,
    xField: (d) => new Date(d.date),
    legend: true,
    children: [
      {
        type: 'line',
        yField: 'close',
        style: {
          stroke: '#5B8FF9',
          lineWidth: 2,
        },
        axis: {
          y: {
            title: 'close',
            style: { titleFill: '#5B8FF9' },
          },
        },
      },
      {
        type: 'line',
        yField: 'pe_ttm',
        style: {
          stroke: '#5AD8A6',
          lineWidth: 2,
        },
        axis: {
          y: {
            position: 'right',
            title: 'pe_ttm',
            style: { titleFill: '#5AD8A6' },
          },
        },
      },
    ],
  };
  return <DualAxes {...config} />;
};

const Home = () => {

  const [list, setList] = useState([]);
  const [pmiData, setPmiData] = useState({});
  const [listresponsmacro_china_urban_unemploymente1, setresponsmacro_china_urban_unemploymente1] = useState([]);
  const [state, setState] = useSetState({
    
  });
  

  const fetchData = async () => {
    try {
      const response = await axios.get(`http://127.0.0.1:8080/api/public/stock_zh_index_hist_csindex?symbol=000985&start_date=20100101&end_date=${today}`)
      const { data = [] } = response;
      console.log('response', response)
      setList(data?.map((item => ({
        label: item?.['指数中文简称'],
        date: item?.['日期'] && moment(item?.['日期']).format('YYYY/MM/DD'),
        close: item?.['收盘'],
        pe_ttm: item?.['滚动市盈率'],
      }))))

      const [{ data: comData }, { data: manData }, { data: serData }] = await Promise.all([
        axios.get(`http://127.0.0.1:8080/api/public/index_pmi_com_cx`), // 综合 PMI
        axios.get(`http://127.0.0.1:8080/api/public/index_pmi_man_cx`), // 制造业 PMI
        axios.get(`http://127.0.0.1:8080/api/public/index_pmi_ser_cx`), // 服务业 PMI
      ]);
      setPmiData({
        comData: comData?.map(item => ({
          ...item,
          type: '综合PMI'
        })), manData: manData?.map(item => ({
          ...item,
          type: '制造业PMI'
        })), serData: serData?.map(item => ({
          ...item,
          type: '服务业PMI'
        }))
      })

      console.log('comData, manData, serData', comData, manData, serData)

      const response1 = await axios.get(`http://127.0.0.1:8080/api/public/index_all_cni`) // 国证指数 -全部指数
      console.log('response1', response1)

      const responsmacro_china_urban_unemploymente1 = await axios.get(`http://127.0.0.1:8080/api/public/macro_china_urban_unemployment`) // 城镇调查失业率
      setresponsmacro_china_urban_unemploymente1(responsmacro_china_urban_unemploymente1?.data || [])
      const macro_china_ppi_yearly = await axios.get(`http://127.0.0.1:8080/api/public/macro_china_ppi_yearly`) // 中国 PPI 年率报告
      const macro_china_cpi_yearly = await axios.get(`http://127.0.0.1:8080/api/public/macro_china_cpi_yearly`) // 中国 CPI 年率报告
      const macro_china_lpr = await axios.get(`http://127.0.0.1:8080/api/public/macro_china_lpr`) // LPR品种数据
      setState({
        macro_china_ppi_yearly: macro_china_ppi_yearly.data,
        macro_china_cpi_yearly: macro_china_cpi_yearly.data,
        macro_china_lpr: macro_china_lpr.data,
      })
    } catch (error) {
      console.log('error', error)
    }

  }
  console.log('state', state)

  const renderPMI = () => {
    const config = {
      xField: (d) => new Date(d['日期']),
      children: [
        {
          data: pmiData?.comData || [],
          type: 'line',
          yField: '综合PMI',
          shapeField: 'smooth',
          colorField: 'type',
          style: {
            lineWidth: 1,
            stroke: '#F6BD16'
          },

        },
        {
          data: pmiData?.manData || [],
          type: 'line',
          yField: '制造业PMI',
          shapeField: 'smooth',
          colorField: 'type',
          style: {
            lineWidth: 1,
            stroke: '#5AD8A6'
          },
          axis: { y: false },
        },
        {
          data: pmiData?.serData || [],
          type: 'line',
          yField: '服务业PMI',
          shapeField: 'smooth',
          colorField: 'type',
          style: {
            lineWidth: 1,
            stroke: '#5D7092'
          },
          axis: { y: false },
        },
      ],
    };
    return <DualAxes {...config} />;
  };


  const renderresponsmacro_china_urban_unemploymente1 = () => {
    const config = {
      xField: (d) => new Date(d.date),
      children: [
        {
          data: listresponsmacro_china_urban_unemploymente1,
          type: 'line',
          yField: 'value',
          colorField: 'item',
          shapeField: 'smooth',
          style: { lineWidth: 3 },
        },
      
      ],
    };
    return <DualAxes {...config} />;
  }


  const rendermacro_china_ppi_yearly = () => {
    const config = {
      xField: (d) => new Date(d['日期']),
      children: [
        {
          data: state.macro_china_ppi_yearly || [],
          type: 'line',
          yField: '今值',
          title: 'title1233',
          shapeField: 'smooth',
          style: { lineWidth: 3 },
          axis: {
            x: {
              // title: '中国 PPI 年率报告',
            }
          }
        },
      
      ],
    };
    return <DualAxes {...config} />;
  }

  const rendermacro_china_cpi_yearly = () => {
    const config = {
      xField: (d) => new Date(d['日期']),
      children: [
        {
          data: state.macro_china_cpi_yearly || [],
          type: 'line',
          yField: '今值',
          shapeField: 'smooth',
          style: { lineWidth: 3 },
          axis: {
            x: {
              // title: '中国 CPI 年率报告',
            }
          }
        },
      
      ],
    };
    return <DualAxes {...config} />;

  }

  const render_macro_china_lpr = () => {
    const config = {
      xField: (d) => new Date(d['TRADE_DATE']),
      children: [
        {
          data: state.macro_china_lpr || [],
          type: 'line',
          yField: 'LPR1Y',
          shapeField: 'smooth',
          style: {
            lineWidth: 1,
            stroke: '#F6BD16'
          },
          axis: {
            x: {
              // title: 'LPR品种数据',
            }
          }
        },
        {
          data: state.macro_china_lpr || [],
          type: 'line',
          yField: 'LPR5Y',
          shapeField: 'smooth',
          style: {
            lineWidth: 1,
            stroke: '#5D7092'
          },
          axis: {
            x: {
              // title: 'LPR品种数据',
            },
            y: false
          }
        },
        {
          data: state.macro_china_lpr || [],
          type: 'line',
          yField: 'RATE_1',
          shapeField: 'smooth',
          style: {
            lineWidth: 1,
            stroke: '#5AD8A6'
          },
          axis: {
            x: {
              // title: 'LPR品种数据',
            },
            y: false
          }
        },
        {
          data: state.macro_china_lpr || [],
          type: 'line',
          yField: 'RATE_2',
          shapeField: 'smooth',
          style: {
            lineWidth: 1,
            stroke: '#5B8FF9'
          },
          axis: {
            x: {
              // title: 'LPR品种数据',
            },
            y: false
          }
        },
        
      
      ],
    };
    return <DualAxes {...config} />;
  }


  useEffect(() => {
    fetchData()

  }, []);


  return <>
    <DemoDualAxes />
    <DemoDualAxes1 />
    {renderPMI()}
    {renderresponsmacro_china_urban_unemploymente1()}
    {rendermacro_china_ppi_yearly()}
    {rendermacro_china_cpi_yearly()}
    {render_macro_china_lpr()}
    {list?.length > 0 && <DemoLine data={list} />}
    <DemoDualAxes2 data={list} />
  </>
};

export default Home;
