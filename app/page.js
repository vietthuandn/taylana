export default function Home() {
  const card = {background:"#fff",borderRadius:20,padding:24,boxShadow:"0 4px 16px #f3c6d633",flex:"1 1 220px"};
  return (
    <main style={{maxWidth:960,margin:"0 auto",padding:"48px 20px",textAlign:"center"}}>
      <h1 style={{fontSize:44,color:"#e06c94",margin:0}}>Tiệm In Taylana ✿</h1>
      <p style={{fontSize:18}}>Thiết kế & thi công CD · In collage · In photostrip</p>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:32}}>
        <div style={card}><h3>💿 CD theo yêu cầu</h3><p>Thiết kế bìa, đĩa và thi công trọn gói.</p></div>
        <div style={card}><h3>🖼️ Collage</h3><p>Tự ghép ảnh, thêm chữ và sticker dễ thương (sắp ra mắt).</p></div>
        <div style={card}><h3>🎞️ Photostrip</h3><p>Dải ảnh 3–4 khung xinh xắn để in (sắp ra mắt).</p></div>
      </div>
    </main>
  );
}
