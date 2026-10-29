export type EtmActionKind = "hunt" | "battle_win" | "checkin" | "collect";

export type EtmAchievementDefinition = {
  id: string;
  title: string;
  description: string;
  action: EtmActionKind;
  target: number;
};

type AchievementMilestone = [id: string, title: string, target: number];

export const etmActionLabels: Record<EtmActionKind, string> = {
  hunt: "Lượt săn được xác nhận",
  battle_win: "Chiến thắng battle",
  checkin: "Lượt daily được xác nhận",
  collect: "Lượt xem zoo được xác nhận",
};

const createMilestones = (
  action: EtmActionKind,
  milestones: AchievementMilestone[],
): EtmAchievementDefinition[] =>
  milestones.map(([id, title, target]) => ({
    id,
    title,
    description: `Đạt ${target} ${etmActionLabels[action].toLowerCase()}.`,
    action,
    target,
  }));

export const etmAchievements: EtmAchievementDefinition[] = [
  {
    id: "first-hunt",
    title: "Mẻ săn đầu tiên",
    description: "Nhận kết quả hunt đầu tiên được OwO xác nhận.",
    action: "hunt",
    target: 1,
  },
  {
    id: "steady-hunter",
    title: "Thợ săn bền bỉ",
    description: "Đạt 10 kết quả hunt được OwO xác nhận.",
    action: "hunt",
    target: 10,
  },
  {
    id: "dedicated-hunter",
    title: "Dấu chân trên 50 vùng đất",
    description: "Đạt 50 kết quả hunt được OwO xác nhận.",
    action: "hunt",
    target: 50,
  },
  {
    id: "legendary-hunter",
    title: "Huyền thoại săn bắt",
    description: "Đạt 100 kết quả hunt được OwO xác nhận.",
    action: "hunt",
    target: 100,
  },
  {
    id: "first-victory",
    title: "Chiến thắng đầu tay",
    description: "Có chiến thắng battle đầu tiên được OwO xác nhận.",
    action: "battle_win",
    target: 1,
  },
  {
    id: "battle-hardened",
    title: "Đấu trường quen thuộc",
    description: "Đạt 5 chiến thắng battle được OwO xác nhận.",
    action: "battle_win",
    target: 5,
  },
  {
    id: "arena-regular",
    title: "Võ đài kỳ cựu",
    description: "Đạt 20 chiến thắng battle được OwO xác nhận.",
    action: "battle_win",
    target: 20,
  },
  {
    id: "first-daily",
    title: "Mở đầu ngày mới",
    description: "Nhận phần thưởng daily đầu tiên được OwO xác nhận.",
    action: "checkin",
    target: 1,
  },
  {
    id: "daily-regular",
    title: "Hẹn gặp mỗi ngày",
    description: "Nhận phần thưởng daily 7 lần được OwO xác nhận.",
    action: "checkin",
    target: 7,
  },
  {
    id: "daily-veteran",
    title: "Thói quen bền lâu",
    description: "Nhận phần thưởng daily 30 lần được OwO xác nhận.",
    action: "checkin",
    target: 30,
  },
  {
    id: "zoo-visitor",
    title: "Lần đầu ghé sở thú",
    description: "Mở zoo lần đầu và nhận phản hồi từ OwO.",
    action: "collect",
    target: 1,
  },
  {
    id: "zoo-explorer",
    title: "Người khám phá sở thú",
    description: "Mở zoo 25 lần và nhận phản hồi từ OwO.",
    action: "collect",
    target: 25,
  },
  ...createMilestones("hunt", [
    ["new-trail", "Dấu chân mới", 2],
    ["warming-up-hunter", "Thợ săn nhập cuộc", 5],
    ["hunt-twenty", "Hai mươi chuyến săn", 20],
    ["expanded-map", "Bản đồ mở rộng", 30],
    ["tracker", "Kẻ truy dấu", 75],
    ["professional-hunter", "Thợ săn chuyên nghiệp", 150],
    ["wild-explorer", "Nhà thám hiểm hoang dã", 250],
    ["wild-spirit", "Linh hồn hoang dã", 500],
    ["wilderness-legend", "Huyền thoại vùng hoang dã", 1000],
    ["beast-scholar", "Bách thú kỳ tài", 1500],
    ["grand-hunter", "Đại thợ săn", 2500],
    ["wildland-ruler", "Thống lĩnh hoang dã", 5000],
  ]),
  ...createMilestones("battle_win", [
    ["second-victory", "Thắng lợi thứ hai", 2],
    ["arena-rhythm", "Bắt nhịp đấu trường", 3],
    ["battle-ten", "Chiến binh chủ lực", 10],
    ["battle-twenty-five", "Kẻ chinh phục", 25],
    ["battle-fifty", "Đấu trường là nhà", 50],
    ["battle-seventy-five", "Bảy mươi lăm lần khải hoàn", 75],
    ["century-of-wins", "Trăm trận khải hoàn", 100],
    ["arena-legend", "Huyền thoại võ đài", 200],
    ["victory-captain", "Đội trưởng chiến thắng", 300],
    ["battle-five-hundred", "Võ thần", 500],
    ["battle-strategist", "Chiến lược gia", 750],
    ["arena-lord", "Chúa tể đấu trường", 1000],
    ["battle-general", "Bách chiến đại tướng", 1500],
  ]),
  ...createMilestones("checkin", [
    ["second-daily", "Ngày thứ hai", 2],
    ["daily-rhythm", "Giữ nhịp mỗi ngày", 3],
    ["two-weeks-present", "Hai tuần kiên trì", 14],
    ["daily-fifty", "Năm mươi lần ghé thăm", 50],
    ["daily-seventy-five", "Mỗi ngày tiến bước", 75],
    ["hundred-day-visitor", "Trăm lần điểm danh", 100],
    ["golden-routine", "Thói quen vàng", 150],
    ["daily-two-hundred", "Điểm danh bền bỉ", 200],
    ["year-of-checkins", "Một năm đồng hành", 365],
    ["daily-five-hundred", "Lời chào thứ năm trăm", 500],
    ["daily-seven-fifty", "Bền gan mỗi ngày", 750],
    ["familiar-friend", "Người bạn thân quen", 1000],
    ["daily-legend", "Nhịp sống huyền thoại", 1500],
  ]),
  ...createMilestones("collect", [
    ["zoo-regular", "Khách quen sở thú", 5],
    ["animal-caretaker", "Người chăm sóc muông thú", 10],
    ["starter-collector", "Nhà sưu tầm nhập môn", 50],
    ["growing-catalog", "Danh mục mở rộng", 75],
    ["zoo-specialist", "Chuyên gia sở thú", 100],
    ["zoo-keeper", "Người chăm thú", 200],
    ["grand-collection", "Bộ sưu tập lớn", 300],
    ["zoo-librarian", "Thủ thư sở thú", 500],
    ["master-collector", "Bậc thầy sưu tầm", 750],
    ["zoo-thousand", "Một nghìn lần khám phá", 1000],
    ["wildlife-curator", "Giám tuyển hoang dã", 1500],
    ["living-museum", "Bảo tàng sống", 2000],
  ]),
];
