/**
 * Timeline Component Template
 * 时间轴组件，用于展示流程和历史记录
 */

export const TimelineComponentTemplate = `
// Timeline Component - 时间轴
interface TimelineItem {
  title: string;
  description?: string;
  timestamp?: string;
  status?: 'completed' | 'active' | 'pending';
  icon?: string;
}

interface TimelineProps {
  items: TimelineItem[];
  title?: string;
}

export const Timeline = ({ items, title }: TimelineProps) => {
  const statusColors = {
    completed: 'bg-green-500',
    active: 'bg-blue-500',
    pending: 'bg-gray-300',
  };

  const statusBorderColors = {
    completed: 'border-green-500',
    active: 'border-blue-500',
    pending: 'border-gray-300',
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold mb-6">{title}</h3>}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
        
        <div className="space-y-6">
          {items.map((item, idx) => {
            const status = item.status || 'completed';
            const dotColor = statusColors[status];
            const borderColor = statusBorderColors[status];

            return (
              <div key={idx} className="relative flex items-start gap-4">
                {/* Dot */}
                <div className={\`relative z-10 flex-shrink-0 w-12 h-12 rounded-full border-4 \${borderColor} bg-white flex items-center justify-center\`}>
                  {item.icon ? (
                    <span className="text-xl">{item.icon}</span>
                  ) : (
                    <div className={\`w-4 h-4 rounded-full \${dotColor}\`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-8">
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-start justify-between">
                      <h4 className="text-base font-semibold text-gray-900">{item.title}</h4>
                      {item.timestamp && (
                        <span className="text-sm text-gray-500 ml-2">{item.timestamp}</span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-gray-600 mt-2">{item.description}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
`;

