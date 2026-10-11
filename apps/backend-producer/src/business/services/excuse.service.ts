import { Excuse, DEVELOPER_EXCUSES } from '@/business/domain/excuse';
import { dispatchDualEmission } from '@/business/tracking.dispatcher';

export class ExcuseService {
  async getRandomExcuse(): Promise<Excuse> {
    const index = Math.floor(Math.random() * DEVELOPER_EXCUSES.length);
    const excuse = new Excuse(index + 1, DEVELOPER_EXCUSES[index]);

    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await dispatchDualEmission({
      category: 'backend_service',
      action: 'daily_excuse',
      label: excuse.excuse,
      value: excuse.id,
      eventId,
      timestamp,
      eventType: 'backend_api'
    });

    return excuse;
  }
}

export const excuseService = new ExcuseService();
