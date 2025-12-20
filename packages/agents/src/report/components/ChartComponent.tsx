/**
 * Chart Component Template
 * 使用 recharts 的图表组件模板
 */

export const ChartComponentTemplate = `
// Chart Component - 支持线图、柱状图、饼图等
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartProps {
  type: 'line' | 'bar' | 'pie';
  data: any[];
  xKey?: string;
  yKey?: string | string[];
  colors?: string[];
  title?: string;
}

export const Chart = ({ type, data, xKey = 'name', yKey = 'value', colors, title }: ChartProps) => {
  const defaultColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];
  const chartColors = colors || defaultColors;

  return (
    <div className="w-full h-full">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        {type === 'line' && (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {Array.isArray(yKey) ? (
              yKey.map((key, idx) => (
                <Line key={key} type="monotone" dataKey={key} stroke={chartColors[idx % chartColors.length]} />
              ))
            ) : (
              <Line type="monotone" dataKey={yKey} stroke={chartColors[0]} />
            )}
          </LineChart>
        )}
        {type === 'bar' && (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {Array.isArray(yKey) ? (
              yKey.map((key, idx) => (
                <Bar key={key} dataKey={key} fill={chartColors[idx % chartColors.length]} />
              ))
            ) : (
              <Bar dataKey={yKey} fill={chartColors[0]} />
            )}
          </BarChart>
        )}
        {type === 'pie' && (
          <PieChart>
            <Pie
              data={data}
              dataKey={typeof yKey === 'string' ? yKey : yKey[0]}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {data.map((entry, index) => (
                <Cell key={\`cell-\${index}\`} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};
`;

