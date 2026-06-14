import { date, entity, role, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', '*', {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
export class RoutePlan {
  @uuid() id!: string;
  @text() orderedAddressIdsJson!: string;
  @text() routeGeoJson!: string;
  @text() totalDistanceMeters!: string;
  @text() totalDurationSeconds!: string;
  @date() createdAt!: Date;
  @text() user_id!: string;
}
