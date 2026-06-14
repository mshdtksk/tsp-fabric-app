import { date, entity, role, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', '*', {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
export class Address {
  @uuid() id!: string;
  @text({ min: 1, max: 500 }) rawAddress!: string;
  @text() latitude!: string;
  @text() longitude!: string;
  @date() createdAt!: Date;
  @text() user_id!: string;
}
