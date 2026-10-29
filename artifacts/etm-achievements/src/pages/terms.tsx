import { Link } from 'wouter';
import { ArrowLeft, Scale } from 'lucide-react';

export default function Terms() {
  return <main className="legal-page" data-testid="page-terms">
    <header className="legal-topbar"><Link href="/" className="legal-brand" data-testid="link-home-terms"><span className="brand-mark">ETM</span><span>Thành tựu của tôi</span></Link><Link href="/" className="back-link" data-testid="link-back-home-terms"><ArrowLeft size={15} /> Về trang chủ</Link></header>
    <article className="legal-document">
      <div className="legal-eyebrow"><Scale size={14} /> TÀI LIỆU CÔNG KHAI · VIỆT NAM</div>
      <h1>Điều khoản sử dụng</h1>
      <p className="legal-lede">Quy tắc sử dụng ETM — một công cụ cộng đồng để theo dõi thành tựu cá nhân.</p>
      <div className="legal-disclaimer" role="note" data-testid="legal-disclaimer-terms"><strong>Lưu ý pháp lý</strong><p>Đây là bản dự thảo thông tin chung, không phải tư vấn pháp lý. Vui lòng nhờ luật sư có đủ chuyên môn tại Việt Nam xem xét trước khi áp dụng.</p></div>
      <div className="legal-meta">BẢN DỰ THẢO · HIỆU LỰC KHI ĐƯỢC ĐĂNG TẢI</div>
      <section><h2>1. ETM là gì?</h2><p>ETM là sản phẩm độc lập do cộng đồng tạo ra, cung cấp không gian cá nhân để theo dõi các dấu mốc liên quan đến việc sử dụng bot OwO. ETM không liên kết, được tài trợ hoặc xác nhận bởi OwO hay Discord. ETM không chạy lệnh OwO thay cho người dùng. Một số kết quả chỉ được ghi nhận khi máy chủ ETM quan sát và xác nhận được; ETM không cam kết phát hiện đầy đủ mọi kết quả hoặc sự kiện.</p></section>
      <section><h2>2. Tài khoản và sử dụng hợp lệ</h2><p>Khi kết nối Discord hoặc sử dụng ETM, bạn đồng ý sử dụng dịch vụ theo các điều khoản này, Quy tắc cộng đồng và Điều khoản dịch vụ của Discord, bao gồm các quy định về độ tuổi áp dụng cho tài khoản của bạn. Bạn chịu trách nhiệm tuân thủ luật pháp áp dụng tại nơi mình sử dụng dịch vụ.</p><p>Không sử dụng ETM để can thiệp trái phép vào hệ thống, làm gián đoạn dịch vụ, truy cập dữ liệu của người khác hoặc vi phạm quyền của bất kỳ bên nào. Việc kết nối chỉ xác thực tài khoản Discord; ETM không yêu cầu bạn cung cấp mật khẩu Discord.</p></section>
      <section><h2>3. Dữ liệu và quyền kiểm soát</h2><p>Dữ liệu thủ công được lưu trong trình duyệt trên thiết bị của bạn. Dữ liệu đồng bộ được lưu trên hệ thống ETM và gắn với tài khoản Discord đã xác thực. Bạn có thể yêu cầu xóa các hoạt động ETM đã đồng bộ qua chức năng trên dashboard hoặc liên hệ <a href="mailto:tannguyenthanh498@gmail.com">tannguyenthanh498@gmail.com</a>. Xóa dữ liệu đồng bộ không xóa bản ghi thủ công trên thiết bị.</p></section>
      <section><h2>4. Dịch vụ và chi phí</h2><p>ETM hiện được cung cấp miễn phí. Tính năng, khả năng tương thích và cách ghi nhận có thể thay đổi. Dịch vụ được cung cấp trên cơ sở nỗ lực hợp lý, không có cam kết về thời gian hoạt động liên tục, độ chính xác hoặc tính đầy đủ của dữ liệu. Có thể xảy ra gián đoạn, mất dữ liệu hoặc thay đổi chức năng.</p></section>
      <section><h2>5. Sở hữu trí tuệ và dịch vụ bên thứ ba</h2><p>ETM là công cụ cộng đồng độc lập. Discord, OwO và các nhãn hiệu liên quan thuộc về chủ sở hữu tương ứng. Việc sử dụng ETM cũng chịu sự điều chỉnh của điều khoản và chính sách của các dịch vụ bên thứ ba mà bạn lựa chọn kết nối.</p></section>
      <section><h2>6. Thay đổi và liên hệ</h2><p>Các điều khoản có thể được cập nhật theo thời gian; phiên bản hiện hành sẽ được đăng tại trang này. Nếu bạn có câu hỏi, hãy liên hệ người vận hành ETM, VinCat, qua <a href="mailto:tannguyenthanh498@gmail.com">tannguyenthanh498@gmail.com</a>.</p></section>
      <footer className="legal-footer"><Link href="/" data-testid="link-home-terms-bottom">Trang chủ</Link><Link href="/privacy" data-testid="link-privacy-from-terms">Chính sách quyền riêng tư</Link><a href="mailto:tannguyenthanh498@gmail.com">Liên hệ</a></footer>
    </article>
  </main>;
}
