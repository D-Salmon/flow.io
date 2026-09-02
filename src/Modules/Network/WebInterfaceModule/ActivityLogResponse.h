#pragma once

#include <WebResponseImpl.h>
#include <Print.h>
#include <esp_heap_caps.h>
#include <string.h>

// Fixed-size PSRAM snapshot owned by the response until the HTTP transfer ends.
// Never grow an AsyncResponseStream in the AsyncTCP callback.
class ActivityLogResponse final : public AsyncAbstractResponse, public Print {
public:
    static constexpr size_t Capacity = 16U * 1024U;
    ActivityLogResponse() {
        _code = 200;
        _contentType = "application/json";
        data_ = static_cast<uint8_t*>(heap_caps_malloc(Capacity, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    }
    ~ActivityLogResponse() override { heap_caps_free(data_); }
    bool ready() const { return data_ != nullptr && !overflow_; }
    bool finish() {
        _contentLength = used_;
        return ready();
    }
    size_t write(uint8_t value) override { return write(&value, 1); }
    size_t write(const uint8_t* data, size_t length) override {
        if (!ready() || length > Capacity - used_) {
            overflow_ = true;
            return 0;
        }
        memcpy(data_ + used_, data, length);
        used_ += length;
        return length;
    }
    bool _sourceValid() const override { return ready(); }
protected:
    size_t _fillBuffer(uint8_t* out, size_t length) override {
        const size_t remaining = used_ - sent_;
        const size_t count = length < remaining ? length : remaining;
        memcpy(out, data_ + sent_, count);
        sent_ += count;
        return count;
    }
private:
    uint8_t* data_ = nullptr;
    size_t used_ = 0;
    size_t sent_ = 0;
    bool overflow_ = false;
};
