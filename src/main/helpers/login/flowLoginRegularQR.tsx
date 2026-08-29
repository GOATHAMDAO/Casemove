import { EAuthTokenPlatformType, LoginSession } from 'steam-session';
import { LoginOptions } from '../../../shared/Interfaces.tsx/store';
import { storeRefreshToken } from '../classes/steam/settings';
import { emitterAccount } from '../../../emitters';

export async function flowLoginRegularQR(doStoreLogin: boolean): Promise<{
  responseStatus: keyof LoginOptions;
  session?: LoginSession;
  errorMessage?: string;
}> {
  return new Promise(async (resolve) => {
    let session = new LoginSession(EAuthTokenPlatformType.SteamClient);
    let isFinished = false;
    const finish = (result: {
      responseStatus: keyof LoginOptions;
      session?: LoginSession;
      errorMessage?: string;
    }) => {
      if (isFinished) return;
      isFinished = true;
      resolve(result);
    };
    console.log('Start with QR');

    session.on('authenticated', async () => {
      console.log(`Logged into Steam as ${session.accountName}`);

      if (doStoreLogin) {
        storeRefreshToken(session.accountName, session.refreshToken);
      }

      finish({
        responseStatus: 'loggedIn',
        session,
      });
    });

    session.once('timeout', () => {
      finish({
        responseStatus: 'defaultError',
        errorMessage: 'Steam QR login timed out. Generate a new QR code and scan it again.',
      });
    });

    session.once('error', (error) => {
      console.error('Steam QR login error:', error);
      finish({
        responseStatus: 'defaultError',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    });
    try {
      emitterAccount.once('qrLogin:cancel', () => {
        session.removeAllListeners('authenticated');
        session.removeAllListeners('timeout');
        session.removeAllListeners('error');
        session.cancelLoginAttempt();
      });
      const { qrChallengeUrl } = await session.startWithQR();
      emitterAccount.emit('qrLogin:show', qrChallengeUrl);
    } catch (error) {
      console.error('Unable to start Steam QR login:', error);
      finish({
        responseStatus: 'defaultError',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
