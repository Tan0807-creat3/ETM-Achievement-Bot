import { Link } from 'wouter';
import { ArrowLeft, CircleAlert } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="not-found-page" data-testid="page-not-found">
      <div className="not-found-card">
        <span className="not-found-mark"><CircleAlert size={19} /></span>
        <div className="legal-eyebrow">MỐC NÀY CHƯA ĐƯỢC GHI</div>
        <h1>Không tìm thấy trang.</h1>
        <p>Đường dẫn này không nằm trong hành trình ETM hiện tại.</p>
        <Link href="/" className="primary-button" data-testid="link-return-home"><ArrowLeft size={15} /> Về dashboard</Link>
      </div>
    </main>
  );
}
