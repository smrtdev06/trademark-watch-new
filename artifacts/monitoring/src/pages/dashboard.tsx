import { Layout } from "@/components/layout";
import { Loader2, AlertOctagon, Eye, Image, UserPlus, Database, FileText } from "lucide-react";
import { useGetDashboardStats, useGetRecordsCount } from "@workspace/api-client-react";
import { Link } from "wouter";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();
  const { data: records } = useGetRecordsCount();

  const s = stats as any;

  const row1Cards = [
    { label: "Total Alerts", value: s?.alertsCount ?? 0, icon: AlertOctagon, color: "text-red-500" },
    { label: "Trademarks Watched", value: s?.keywordsCount ?? 0, icon: Eye, color: "text-green-500" },
    { label: "Latest Journal", value: s?.latestCountry && s?.latestJournal ? `${s.latestCountry} - ${s.latestJournal}` : "-", icon: FileText, color: "text-yellow-500", isSmall: true },
  ];

  const row2Cards = [
    { label: "Total Logo Watched", value: s?.logoCount ?? 0, icon: Image, color: "text-blue-500" },
    { label: "Client / Attorney Contacts", value: s?.clientsCount ?? 0, icon: UserPlus, color: "text-yellow-500" },
    { label: "Market Citations In DB", value: "-", icon: Database, color: "text-green-500" },
  ];

  const quickLinks = [
    { label: "Click Here To Conduct Name Check", href: "/assessment" },
    { label: "Click To Search Statutory Records", href: "/license" },
    { label: "Click Here To Create Alert", href: "/alerts" },
    { label: "Click Here For Marketplace Watch", href: "/social-watch/list" },
  ];

  const chartData = records && (records as any).x && (records as any).y
    ? ((records as any).x as string[]).map((date: string, i: number) => ({
        date,
        count: (records as any).y[i] ?? 0,
      }))
    : [];

  return (
    <Layout>
      <div className="mb-4">
        <h4 className="text-xl font-semibold text-gray-800">Dashboard</h4>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {row1Cards.map((card) => (
              <div key={card.label} className="bg-white rounded shadow-sm border">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <span className="text-xs font-bold text-gray-500 uppercase">{card.label}</span>
                    {card.isSmall ? (
                      <h5 className="text-lg font-bold mt-1">{card.value}</h5>
                    ) : (
                      <h2 className="text-2xl font-bold mt-1">{card.value}</h2>
                    )}
                  </div>
                  <card.icon className={`w-8 h-8 ${card.color}`} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {row2Cards.map((card) => (
              <div key={card.label} className="bg-white rounded shadow-sm border">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <span className="text-xs font-bold text-gray-500 uppercase">{card.label}</span>
                    <h2 className="text-2xl font-bold mt-1">{card.value}</h2>
                  </div>
                  <card.icon className={`w-8 h-8 ${card.color}`} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <div className="bg-white rounded shadow-sm border p-4 text-center hover:bg-gray-50 cursor-pointer transition-colors">
                  <span className="text-xs font-bold text-gray-500 uppercase">{link.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="bg-white rounded shadow-sm border p-4">
        <h5 className="font-semibold text-gray-800 mb-3">Total Records</h5>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={296}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="45%" stopColor="#43d39e" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#43d39e" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#43d39e" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" name="Count" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[296px] text-gray-400 text-sm">
            No records data available yet
          </div>
        )}
      </div>
    </Layout>
  );
}
