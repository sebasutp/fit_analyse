package main

import (
	"bytes"
	"fmt"
	"io" // Import the io package
	"os"
	"time"

	"github.com/apache/arrow/go/v17/arrow" // Updated import path convention
	"github.com/apache/arrow/go/v17/arrow/array"
	"github.com/apache/arrow/go/v17/arrow/ipc"
	"github.com/apache/arrow/go/v17/arrow/memory"
	"github.com/tormoder/fit"
)

// Define the fields we want to extract
var desiredFields = []string{
	"timestamp",
	"position_lat",
	"position_long",
	"distance",
	"speed",
	"power",
	"temperature",
	"altitude",
}

// Helper function to get Arrow type for a given field name
func getArrowType(fieldName string) arrow.DataType {
	switch fieldName {
	case "timestamp":
		// Using seconds precision timestamp as in the original example
		// Can be Timestamp_ms, Timestamp_us, Timestamp_ns if needed
		return arrow.FixedWidthTypes.Timestamp_s
	case "position_lat", "position_long":
		return arrow.PrimitiveTypes.Int32
	case "distance":
		return arrow.PrimitiveTypes.Uint32
	case "power", "speed", "altitude":
		// Power is often Uint16 in FIT files
		return arrow.PrimitiveTypes.Uint16
	case "temperature":
		// Temperature is often Sint8
		return arrow.PrimitiveTypes.Int8
	// Add cases for other fields if needed later, e.g.:
	// case "gps_accuracy": return arrow.PrimitiveTypes.Uint8
	// case "cadence": return arrow.PrimitiveTypes.Uint8
	// case "ascent", "descent": return arrow.PrimitiveTypes.Uint16
	// case "calories": return arrow.PrimitiveTypes.Uint16
	// case "grade": return arrow.PrimitiveTypes.Float32 // Or Int16 depending on source
	default:
		panic(fmt.Sprintf("Unsupported field name: %s", fieldName)) // Or handle more gracefully
	}
}

func main() {
	// --- File Reading & Decoding ---
	// Read all data from standard input
	fitData, err := io.ReadAll(os.Stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading from stdin: %v\n", err)
		os.Exit(1)
	}

	// Decode the FIT data read from stdin
	fitDecoded, err := fit.Decode(bytes.NewReader(fitData))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error decoding fit data from stdin: %v\n", err)
		os.Exit(1)
	}

	activity, err := fitDecoded.Activity()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting activity from fit data: %v\n", err)
		os.Exit(1)
	}

	// --- Arrow Setup ---
	allocator := memory.NewGoAllocator()

	// 1. Dynamically build schema fields
	schemaFields := make([]arrow.Field, len(desiredFields))
	for i, name := range desiredFields {
		schemaFields[i] = arrow.Field{
			Name:     name,
			Type:     getArrowType(name),
			Nullable: false, // As requested, assuming primitive values always exist
		}
	}
	schema := arrow.NewSchema(schemaFields, nil)

	// 2. Dynamically create builders based on schema
	builders := make([]array.Builder, len(desiredFields))
	defer func() {
		// Release builders *after* arrays are built or if an error occurs mid-loop
		for _, b := range builders {
			if b != nil {
				b.Release()
			}
		}
	}()
	for i, field := range schema.Fields() {
		switch field.Type.ID() {
		case arrow.TIMESTAMP:
			builders[i] = array.NewTimestampBuilder(allocator, field.Type.(*arrow.TimestampType))
		case arrow.INT32:
			builders[i] = array.NewInt32Builder(allocator)
		case arrow.INT8:
			builders[i] = array.NewInt8Builder(allocator)
		case arrow.UINT16:
			builders[i] = array.NewUint16Builder(allocator)
		case arrow.UINT32:
			builders[i] = array.NewUint32Builder(allocator)
		// Add cases for other types if needed
		default:
			fmt.Fprintf(os.Stderr, "Error creating builder: Unsupported Arrow type %s for field %s\n", field.Type.Name(), field.Name)
			os.Exit(1)
		}
	}

	// --- Data Processing ---
	// 3. Iterate through records and append data
	// Filter for Record messages specifically, as they contain the per-point data
	recordMsgs := activity.Records
	if len(recordMsgs) == 0 {
		fmt.Fprintf(os.Stderr, "No record messages found in the activity.\n")
		// Decide if this is an error or just means an empty output
		// os.Exit(1) // Or just proceed to write an empty file/stream
	}

	for _, record := range recordMsgs {
		for i, fieldName := range desiredFields {
			// Use type assertion on the builder to call the correct Append method
			switch b := builders[i].(type) {
			case *array.TimestampBuilder:
				// Convert fit.DateTime to Unix seconds for arrow.Timestamp_s
				ts := record.Timestamp // This is a fit.DateTime
				// Check if timestamp is valid before converting
				if ts.IsZero() || ts.Before(time.Date(1989, 12, 31, 0, 0, 0, 0, time.UTC)) {
					// Handle invalid timestamp, e.g., append zero or skip record?
					// Appending zero for simplicity here. FIT Epoch is 1989-12-31 00:00:00 UTC
					// Arrow timestamp often uses Unix Epoch 1970-01-01 00:00:00 UTC
					b.Append(arrow.Timestamp(0)) // Append Unix Epoch zero
				} else {
					b.Append(arrow.Timestamp(ts.Unix()))
				}

			case *array.Int32Builder:
				switch fieldName {
				case "position_lat":
					b.Append(record.PositionLat.Semicircles())
				case "position_long":
					b.Append(record.PositionLong.Semicircles())
				default:
					panic("Unhandled Int32 field: " + fieldName)
				}
			case *array.Int8Builder:
				switch fieldName {
				case "temperature":
					b.Append(record.Temperature)
				default:
					panic("Unhandled Int8 field: " + fieldName)
				}
			case *array.Uint16Builder:
				switch fieldName {
				case "power":
					b.Append(record.Power)
				case "speed":
					// Use EnhancedSpeed if available and valid, otherwise Speed
					spd := record.Speed
					b.Append(spd)
				case "altitude":
					// Use EnhancedAltitude if available and valid, otherwise Altitude
					alt := record.Altitude
					b.Append(alt)
				default:
					panic("Unhandled Uint16 field: " + fieldName)
				}
			case *array.Uint32Builder:
				switch fieldName {
				case "distance":
					b.Append(record.Distance)
				default:
					panic("Unhandled Uint32field: " + fieldName)
				}
			default:
				panic(fmt.Sprintf("Unhandled builder type for field %s", fieldName))
			}
		}
	}

	// --- Arrow Array & Record Creation ---
	// 4. Build final arrays from builders
	arrays := make([]arrow.Array, len(builders))
	defer func() {
		// Release arrays *after* record is created/written
		for _, arr := range arrays {
			if arr != nil {
				arr.Release()
			}
		}
	}()
	for i, b := range builders {
		arrays[i] = b.NewArray()
		// Builder memory is released by the defer func earlier
	}

	// 5. Create the record (table)
	arrowRecord := array.NewRecord(schema, arrays, int64(len(recordMsgs))) // Provide row count if known
	defer arrowRecord.Release()

	// --- Arrow Writing ---
	// 6. Create an IPC writer (writing to stdout here)
	// To write to a file:
	// outFile, err := os.Create("output.arrow")
	// if err != nil { ... }
	// defer outFile.Close()
	// writer := ipc.NewFileWriter(outFile, ipc.WithSchema(schema), ipc.WithAllocator(allocator))
	// Or stream format:
	writer := ipc.NewWriter(os.Stdout, ipc.WithSchema(schema), ipc.WithAllocator(allocator))
	defer func() {
		if err := writer.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "Error closing Arrow writer: %v\n", err)
		}
	}()

	// 7. Write the record
	if err := writer.Write(arrowRecord); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing Arrow record: %v\n", err)
		os.Exit(1)
	}

	fmt.Fprintf(os.Stderr, "Successfully processed %d records from stdin and wrote Arrow data to stdout.\n", len(recordMsgs))
}
