import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  LinearScale,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LinearScale,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export default function PieChart({ data, headerName }) {
  const chartTextColor = document.documentElement.classList.contains('dark')
    ? '#d6d3cd'
    : '#374151';

  const title = (tooltipItems) => {
    let percentageData: Array<number> = [];
    let sum = 0;

    tooltipItems.dataset.data.forEach((element) => {
      sum += element;
    });
    tooltipItems.dataset.data.forEach((element) => {
      let percentage = (element * 100) / sum;
      percentageData.push(percentage);
    });
    return tooltipItems.label + ': ' + tooltipItems.raw  + ' - ' + percentageData[tooltipItems.dataIndex].toFixed(2) + '%'
  };

  // Radar options
  const options = {
    plugins: {
      legend: {
        labels: {
          position: 'right',
          color: chartTextColor,
        },
      },
      title: {
        display: true,
        text: headerName,
        color: chartTextColor,
      },
      tooltip: {
        callbacks: {
          label: title,
        },
      },
      datalabels: {
        formatter: (value, ctx) => {
          let sum = 0;
          let dataArr = ctx.chart.data.datasets[0].data;
          dataArr.map((data) => {
            sum += data;
          });
          let percentage = ((value * 100) / sum).toFixed(2) + '%';
          return percentage;
        },
        color: '#fff',
        display: function (context) {
          let percentageData: Array<number> = [];
          let sum = 0;

          context.dataset.data.forEach((element) => {
            sum += element;
          });
          context.dataset.data.forEach((element) => {
            let percentage = (element * 100) / sum;
            percentageData.push(percentage);
          });

          if (percentageData[context.dataIndex] > 4) {
            return true;
          }
          if (percentageData[context.dataIndex] > 2) {
            return 'auto';
          }
          return false;

        },
      },
    },
  };

  return (
    <>

      <Pie data={data} plugins={
         // @ts-ignore
         [ChartDataLabels]} options={options} />
    </>
  );
}
