#include "Board/BoardCatalog.h"

#include "Board/WaveshareBoard.h"

namespace BoardCatalog {

const BoardSpec& waveshareESP32S3()
{
    return BoardProfiles::kWaveshareESP32S3;
}

const BoardSpec& activeBoard()
{
    return waveshareESP32S3();
}

}  // namespace BoardCatalog
