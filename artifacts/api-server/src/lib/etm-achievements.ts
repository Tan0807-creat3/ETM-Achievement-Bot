export type EtmActionKind = "hunt" | "battle_win" | "checkin" | "collect";

export type EtmAchievementDefinition = {
  id: string;
  title: string;
  description: string;
  action: EtmActionKind;
  target: number;
};

export const etmActionLabels: Record<EtmActionKind, string> = {
  hunt: "Lượt săn được xác nhận",
  battle_win: "Chiến thắng battle",
  checkin: "Lượt daily được xác nhận",
  collect: "Lượt xem zoo được xác nhận",
};

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
];
