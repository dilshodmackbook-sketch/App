import {hasCompleteAddress, hasLegalName} from '@libs/PersonalDetailsUtils';

import type {PrivatePersonalDetails} from '@src/types/onyx';

/**
 * Returns the initial substep for the Personal Info step based on already existing data
 */
function getSkippedStepsPersonalInfo(data?: Partial<PrivatePersonalDetails>): number[] {
    const skippedSteps = [];
    if (hasLegalName(data)) {
        skippedSteps.push(1);
    }

    if (hasCompleteAddress(data)) {
        skippedSteps.push(2);
    }

    if (data?.phoneNumber) {
        skippedSteps.push(3);
    }

    return skippedSteps;
}

export default getSkippedStepsPersonalInfo;
