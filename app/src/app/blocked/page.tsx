export default async function BlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  return (
    <div className="card" style={{ maxWidth: 480, margin: "4rem auto" }}>
      <h1>服务不可用</h1>
      <p>
        根据您所在司法辖区（{country ?? "未知"}），X-Market 当前不对该地区提供服务。
      </p>
      <p className="hint">
        本应用为非托管链上协议前端；合规策略由运营方配置。如有疑问请联系支持。
      </p>
    </div>
  );
}
