#include "Profiles/Waveshare/WaveshareProfile.h"

#include "Board/BoardCatalog.h"
#include "Board/BoardSpec.h"

namespace Profiles {
namespace Waveshare {

#if defined(FLOW_ENABLE_LOCAL_TFT_HMI) && (FLOW_ENABLE_LOCAL_TFT_HMI != 0)
namespace {
static constexpr SupervisorRuntimeOptions kLocalTftRuntimeOptions{
    60000U,
    5000U
};
}  // namespace
#endif

ModuleInstances::ModuleInstances(const BoardSpec& board)
    : ethernetModule(board),
      wifiModule(board),
      webInterfaceModule(board),
      firmwareUpdateModule(board),
#if defined(FLOW_ENABLE_LOCAL_TFT_HMI) && (FLOW_ENABLE_LOCAL_TFT_HMI != 0)
      supervisorHMIModule(board, kLocalTftRuntimeOptions),
#endif
#if defined(FLOW_ENABLE_TFT_S3) && (FLOW_ENABLE_TFT_S3 != 0)
      tftModuleS3(board),
#endif
      hmiModule(board),
      hmiBuzzerModule(board),
      ioModule(board)
{
}

ModuleInstances& moduleInstances()
{
    static ModuleInstances instances{BoardCatalog::activeBoard()};
    return instances;
}

}  // namespace Waveshare
}  // namespace Profiles
