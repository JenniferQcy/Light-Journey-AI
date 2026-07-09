-- 轻途AI - Supabase数据库建表脚本
-- 说明：所有表均为匿名访问设计，无用户系统，使用匿名ID标识设备

-- 启用UUID扩展
create extension if not exists "uuid-ossp";

-- ============================================
-- 行程计划表
-- ============================================
create table if not exists travel_plans (
  id uuid primary key default uuid_generate_v4(),
  anonymous_id text not null,
  destination text not null,
  days integer not null,
  people_count integer not null default 1,
  budget_level text not null check (budget_level in ('budget', 'normal', 'comfortable')),
  preferences text[] not null default '{}',
  items jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_travel_plans_anonymous_id on travel_plans(anonymous_id);
create index if not exists idx_travel_plans_created_at on travel_plans(created_at desc);

-- ============================================
-- 景点口碑缓存表
-- ============================================
create table if not exists scenic_reviews (
  id uuid primary key default uuid_generate_v4(),
  scenic_name text not null,
  city text,
  summary text not null,
  pros text[] not null default '{}',
  cons text[] not null default '{}',
  tips text[] not null default '{}',
  source_count integer not null default 0,
  created_at timestamp with time zone default now()
);

create unique index if not exists idx_scenic_reviews_name_city on scenic_reviews(scenic_name, coalesce(city, ''));
create index if not exists idx_scenic_reviews_created_at on scenic_reviews(created_at desc);

-- ============================================
-- 旅行图片表
-- ============================================
create table if not exists travel_images (
  id uuid primary key default uuid_generate_v4(),
  anonymous_id text not null,
  plan_id uuid references travel_plans(id) on delete set null,
  file_name text not null,
  compressed_url text not null,
  original_url text,
  file_size bigint not null default 0,
  compressed_size bigint not null default 0,
  note text,
  tags text[] not null default '{}',
  uploaded_at timestamp with time zone default now()
);

create index if not exists idx_travel_images_anonymous_id on travel_images(anonymous_id);
create index if not exists idx_travel_images_plan_id on travel_images(plan_id);
create index if not exists idx_travel_images_uploaded_at on travel_images(uploaded_at desc);

-- ============================================
-- 旅行游记表
-- ============================================
create table if not exists travel_journals (
  id uuid primary key default uuid_generate_v4(),
  anonymous_id text not null,
  plan_id uuid references travel_plans(id) on delete set null,
  title text not null,
  content text not null default '',
  image_ids uuid[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_travel_journals_anonymous_id on travel_journals(anonymous_id);
create index if not exists idx_travel_journals_plan_id on travel_journals(plan_id);
create index if not exists idx_travel_journals_created_at on travel_journals(created_at desc);

-- ============================================
-- 图片存储Bucket配置
-- ============================================
-- 在Supabase控制台手动创建名为 travel-photos 的存储bucket
-- 设置为私有bucket，通过Edge Function生成签名URL访问

-- ============================================
-- RLS (行级安全) 策略
-- 说明：由于是匿名访问，使用anonymous_id来隔离不同设备的数据
-- ============================================

-- 启用RLS
alter table travel_plans enable row level security;
alter table scenic_reviews enable row level security;
alter table travel_images enable row level security;
alter table travel_journals enable row level security;

-- travel_plans 策略
create policy "匿名用户可读取自己的行程"
  on travel_plans for select
  using (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

create policy "匿名用户可插入行程"
  on travel_plans for insert
  with check (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

create policy "匿名用户可更新自己的行程"
  on travel_plans for update
  using (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id')
  with check (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

create policy "匿名用户可删除自己的行程"
  on travel_plans for delete
  using (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

-- scenic_reviews 策略（公开可读，仅Edge Function可写）
create policy "口碑缓存公开可读"
  on scenic_reviews for select
  using (true);

-- travel_images 策略
create policy "匿名用户可读取自己的图片"
  on travel_images for select
  using (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

create policy "匿名用户可插入图片记录"
  on travel_images for insert
  with check (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

create policy "匿名用户可删除自己的图片"
  on travel_images for delete
  using (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

create policy "匿名用户可更新自己的图片"
  on travel_images for update
  using (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id')
  with check (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

-- travel_journals 策略
create policy "匿名用户可读取自己的游记"
  on travel_journals for select
  using (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

create policy "匿名用户可插入游记"
  on travel_journals for insert
  with check (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

create policy "匿名用户可更新自己的游记"
  on travel_journals for update
  using (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id')
  with check (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

create policy "匿名用户可删除自己的游记"
  on travel_journals for delete
  using (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

-- ============================================
-- 更新时间触发器
-- ============================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_travel_plans_updated_at
  before update on travel_plans
  for each row
  execute function update_updated_at_column();

create trigger update_travel_journals_updated_at
  before update on travel_journals
  for each row
  execute function update_updated_at_column();
