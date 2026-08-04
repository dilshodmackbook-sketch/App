import {act, renderHook, waitFor} from '@testing-library/react-native';

import type {FileObject} from '@src/types/utils/Attachment';

// Every selected file is a HEIC that fails validation and is routed to the converter.
// 'heicOrHeifImage' mirrors CONST.FILE_VALIDATION_ERRORS.HEIC_OR_HEIF_IMAGE (inlined because a jest.mock
// factory is hoisted above imports and cannot reference the out-of-scope CONST module).
jest.mock('@libs/validateAttachmentFile', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve({isValid: false, error: 'heicOrHeifImage'})),
}));

// Track how many conversions are in flight at once. Each call resolves on a later timer so that, if the hook
// fanned the batch out with Promise.all, all of them would be in flight simultaneously (peak === batch size).
const mockConvert = {inFlight: 0, peak: 0, calls: 0};
jest.mock('@libs/fileDownload/heicConverter', () => ({
    __esModule: true,
    default: (file: FileObject, {onSuccess}: {onSuccess: (converted: FileObject) => void}) => {
        mockConvert.calls++;
        mockConvert.inFlight++;
        mockConvert.peak = Math.max(mockConvert.peak, mockConvert.inFlight);
        setTimeout(() => {
            mockConvert.inFlight--;
            onSuccess({...file, name: `${file.name}.jpg`, type: 'image/jpeg', size: 1000, uri: `${file.uri}.jpg`});
        }, 0);
    },
}));

// eslint-disable-next-line import/first
import useFilesValidation from '@hooks/useFilesValidation';

jest.useFakeTimers();

describe('useFilesValidation HEIC conversion', () => {
    beforeEach(() => {
        mockConvert.inFlight = 0;
        mockConvert.peak = 0;
        mockConvert.calls = 0;
    });

    it('converts 30 HEIC files one at a time (never more than one decode in flight) and preserves order', async () => {
        const files: FileObject[] = Array.from({length: 30}, (_, i) => ({name: `receipt-${i}.heic`, type: 'image/heic', uri: `file://receipt-${i}.heic`, size: 5_000_000}));

        let validated: FileObject[] | undefined;
        const {result} = renderHook(() => useFilesValidation((validFiles) => (validated = validFiles)));

        act(() => {
            result.current.validateFiles(files, [], {isValidatingReceipts: true});
        });

        // Drain the sequential loop: each conversion resolves on a timer, unblocking the next.
        await waitFor(
            () => {
                jest.runOnlyPendingTimers();
                expect(mockConvert.calls).toBe(30);
            },
            {timeout: 5000},
        );
        await waitFor(() => expect(validated).toHaveLength(30));

        expect(mockConvert.peak).toBe(1);
        expect(validated?.map((f) => f.uri)).toEqual(files.map((f) => `${f.uri}.jpg`));
    });
});
